import { SIGNATURE } from "./signature";
import type { ReplyClass } from "./types";

/**
 * Copiloto de IA do console (PRD §29): briefing executivo do dia e sugestão de
 * triagem de resposta. Fetch direto na API da Anthropic, sem SDK.
 *
 * Regras duras:
 * - PII NUNCA sai daqui: prompts levam só agregados, primeiro nome, cargo,
 *   indústria e o texto da resposta com e-mails redigidos (redactEmails);
 * - a IA nunca age sozinha: devolve texto e sugestão; classificar, gravar e
 *   enviar continuam humanos;
 * - saída sem travessão (sanitizeAiText), como toda superfície da plataforma.
 */

export const AI_MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
/** Modelo OpenAI padrão (barato e atual na conta do Luigi); override por OUTBOUND_OPENAI_MODEL. */
const OPENAI_DEFAULT_MODEL = "gpt-5.4-mini";
const TIMEOUT_MS = 30_000;

export function anthropicKey(): string | null {
  return process.env.OUTBOUND_ANTHROPIC_API_KEY?.trim() || null;
}

export function openaiKey(): string | null {
  return process.env.OUTBOUND_OPENAI_API_KEY?.trim() || null;
}

export function openaiModel(): string {
  return process.env.OUTBOUND_OPENAI_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
}

export type AiProvider = "anthropic" | "openai";

/** Dois motores possíveis; a Anthropic tem preferência quando as duas chaves existem. */
export function aiProvider(): AiProvider | null {
  if (anthropicKey()) return "anthropic";
  if (openaiKey()) return "openai";
  return null;
}

/** Nome do modelo ativo (gravado no briefing e mostrado na UI). */
export function aiModelLabel(): string {
  return aiProvider() === "openai" ? openaiModel() : AI_MODEL;
}

export function aiAvailable(): boolean {
  return aiProvider() !== null;
}

/** Qualquer coisa com @ vira marcador: e-mail de contato jamais entra em prompt. */
export function redactEmails(text: string): string {
  return text.replace(/\S*@\S*/g, "[contato]");
}

/** Remove travessão da saída da IA (regra da casa) sem quebrar a leitura. */
export function sanitizeAiText(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/* ─── Prompts (puros, testáveis, sem PII) ─────────────────────────────────── */

export interface BriefingAggregates {
  dateKey: string;
  armada: boolean;
  capDia: number;
  usadosHoje: number;
  enviadosTotal: number;
  entreguesTotal: number;
  bounceRatePct: number;
  respostasReais: number;
  interessados: number;
  tarefasHojeOuVencidas: number;
  demandasPendentes: number;
  reunioesMarcadas: number;
  reunioesRealizadas: number;
  pipeline: Array<{ estagio: string; quantidade: number }>;
  campanhas: Array<{ industria: string; enviados: number; respostas: number; interessados: number }>;
}

export function buildBriefingPrompt(a: BriefingAggregates): string {
  return [
    `Você é o MORK, diretor de vendas da Dreamy. Escreva o briefing executivo do dia ${a.dateKey} para o time, em português do Brasil.`,
    "Regras: no máximo 160 palavras; texto corrido ou até 5 tópicos curtos; comece pelo que importa (interessados, reuniões, riscos); termine com a ação mais importante de hoje; nunca use o caractere travessão; use APENAS os números fornecidos abaixo, sem inventar nada; se um número for zero, diga com naturalidade.",
    "Dados do dia (JSON):",
    JSON.stringify(a),
  ].join("\n\n");
}

export interface TriageInput {
  /** Texto da resposta recebida (será redigido: e-mails viram [contato]). */
  texto: string;
  primeiroNome?: string;
  cargo?: string;
  industria?: string;
}

export function buildTriagePrompt(input: TriageInput): string {
  const quem = [
    input.primeiroNome ? `primeiro nome: ${redactEmails(input.primeiroNome)}` : null,
    input.cargo ? `cargo: ${redactEmails(input.cargo)}` : null,
    input.industria ? `indústria: ${redactEmails(input.industria)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return [
    `Você ajuda ${SIGNATURE.nome}, sócio fundador da Dreamy (estúdio de software B2B), a triar respostas de cold e-mail.`,
    'Responda SOMENTE um JSON válido neste formato: {"classe":"interested|not_now|referral|negative|ooo|other","resumo":"até 2 frases sobre o que a pessoa disse","rascunho":"resposta pronta"}.',
    `Regras do rascunho: voz direta e pessoal de ${SIGNATURE.nome} (de dono para dono), até 90 palavras, sem saudação genérica, sem jargão de marketing, nunca use o caractere travessão, termine com um próximo passo concreto (dia e hora sugeridos para uma conversa curta, quando fizer sentido) e NÃO inclua assinatura (ela é automática).`,
    quem ? `Sobre quem respondeu: ${quem}.` : null,
    "Resposta recebida (e-mails já removidos):",
    redactEmails(input.texto),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/* ─── Chamada HTTP ────────────────────────────────────────────────────────── */

async function callAnthropic(prompt: string, maxTokens: number): Promise<string> {
  const key = anthropicKey();
  if (!key) throw new Error("OUTBOUND_ANTHROPIC_API_KEY ausente: recursos de IA desligados.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": API_VERSION },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      err instanceof Error && err.name === "AbortError"
        ? "A API da Anthropic demorou demais (30 s). Tente de novo."
        : "Não deu para falar com a API da Anthropic. Confira a rede e tente de novo.",
    );
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("Chave da Anthropic inválida ou sem permissão (OUTBOUND_ANTHROPIC_API_KEY).");
  }
  if (res.status === 429)
    throw new Error("Limite de uso da API da Anthropic atingido. Espere um pouco e tente de novo.");
  if (res.status >= 500) throw new Error("API da Anthropic instável agora. Tente de novo em instantes.");
  if (!res.ok) throw new Error(`API da Anthropic recusou a chamada (HTTP ${res.status}).`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("A API da Anthropic respondeu vazio. Tente de novo.");
  return text;
}

async function callOpenAI(prompt: string, maxTokens: number): Promise<string> {
  const key = openaiKey();
  if (!key) throw new Error("OUTBOUND_OPENAI_API_KEY ausente.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: openaiModel(),
        // Modelos gpt-5+ gastam parte do orçamento em raciocínio interno: folga proposital.
        max_completion_tokens: Math.max(maxTokens * 2, 600),
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      err instanceof Error && err.name === "AbortError"
        ? "A API da OpenAI demorou demais (30 s). Tente de novo."
        : "Não deu para falar com a API da OpenAI. Confira a rede e tente de novo.",
    );
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("Chave da OpenAI inválida ou sem permissão (OUTBOUND_OPENAI_API_KEY).");
  }
  if (res.status === 404) {
    throw new Error(`A OpenAI não conhece o modelo "${openaiModel()}" nesta conta (ajuste OUTBOUND_OPENAI_MODEL).`);
  }
  if (res.status === 429) {
    throw new Error("Limite ou crédito da API da OpenAI esgotado. Confira o billing em platform.openai.com.");
  }
  if (res.status >= 500) throw new Error("API da OpenAI instável agora. Tente de novo em instantes.");
  if (!res.ok) throw new Error(`API da OpenAI recusou a chamada (HTTP ${res.status}).`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = (data.choices ?? [])
    .map((choice) => choice.message?.content ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("A API da OpenAI respondeu vazio. Tente de novo.");
  return text;
}

/** Despacha para o motor ativo. Sem chave nenhuma: falha fechado com instrução. */
async function callAi(prompt: string, maxTokens: number): Promise<string> {
  const provider = aiProvider();
  if (provider === "anthropic") return callAnthropic(prompt, maxTokens);
  if (provider === "openai") return callOpenAI(prompt, maxTokens);
  throw new Error("Recursos de IA desligados: defina OUTBOUND_ANTHROPIC_API_KEY ou OUTBOUND_OPENAI_API_KEY.");
}

/* ─── Recursos ────────────────────────────────────────────────────────────── */

export async function generateBriefing(aggregates: BriefingAggregates): Promise<string> {
  return sanitizeAiText(await callAi(buildBriefingPrompt(aggregates), 800));
}

const REPLY_CLASSES: ReplyClass[] = ["interested", "not_now", "referral", "negative", "ooo", "other"];

export interface TriageSuggestion {
  classe: ReplyClass;
  resumo: string;
  rascunho: string;
}

/** Parse defensivo: acha o primeiro bloco {...}; classe desconhecida vira "other". */
export function parseTriageResponse(raw: string): TriageSuggestion {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  let parsed: Record<string, unknown> = {};
  if (start >= 0 && end > start) {
    try {
      parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      // segue com defaults abaixo
    }
  }
  const classeRaw = typeof parsed.classe === "string" ? parsed.classe : "";
  const classe = (REPLY_CLASSES as string[]).includes(classeRaw) ? (classeRaw as ReplyClass) : "other";
  const resumo = sanitizeAiText(typeof parsed.resumo === "string" ? parsed.resumo : raw.slice(0, 240));
  const rascunho = sanitizeAiText(typeof parsed.rascunho === "string" ? parsed.rascunho : "");
  return { classe, resumo, rascunho };
}

/* ─── Chat do console (Pergunte ao MORK) ──────────────────────────────────── */

export interface ConsoleChatTurn {
  papel: "voce" | "mork";
  texto: string;
}

/**
 * Prompt do chat lateral: o MORK responde SOMENTE com os agregados do console
 * (sem PII: e-mails redigidos aqui e o contexto já nasce sem contato pessoal).
 * Gate humano absoluto: o chat nunca executa ação nenhuma.
 */
export function buildConsoleChatPrompt(contexto: string, historico: ConsoleChatTurn[], pergunta: string): string {
  const conversa = historico
    .map((t) => `${t.papel === "voce" ? "Usuário" : "MORK"}: ${redactEmails(t.texto)}`)
    .join("\n");
  return [
    "Você é o MORK, o agente de vendas da Dreamy, respondendo dentro do console interno da plataforma (CRM).",
    "Responda em português do Brasil, direto e específico, em no máximo 120 palavras.",
    "Use SOMENTE os dados do contexto abaixo. Se o dado pedido não estiver lá, diga que ele não está à mão e aponte a aba do console mais próxima (Visão geral, Hoje, Agenda, Pipeline, Contatos, Respostas, Atividade, Demandas, MORK, Supressão).",
    "Você não executa nada por aqui: se pedirem uma ação, explique onde fazer (aba do console ou CLI do MORK).",
    "Nunca invente números. Não use travessão.",
    "",
    "=== CONTEXTO DO WORKSPACE (agora) ===",
    redactEmails(contexto),
    conversa ? "\n=== CONVERSA ATÉ AQUI ===\n" + conversa : "",
    "",
    `Usuário: ${redactEmails(pergunta)}`,
    "MORK:",
  ].join("\n");
}

export async function answerConsoleQuestion(
  contexto: string,
  historico: ConsoleChatTurn[],
  pergunta: string,
): Promise<string> {
  return sanitizeAiText(await callAi(buildConsoleChatPrompt(contexto, historico, pergunta), 500));
}

export async function suggestReplyTriage(input: TriageInput): Promise<TriageSuggestion> {
  return parseTriageResponse(await callAi(buildTriagePrompt(input), 700));
}
