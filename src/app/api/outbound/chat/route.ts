import { NextResponse, type NextRequest } from "next/server";
import { campaigns } from "@/content/outbound";
import { logger } from "@/lib/observability/logger";
import { aiAvailable, aiModelLabel, answerConsoleQuestion, type ConsoleChatTurn } from "@/lib/outbound/ai";
import { getSession } from "@/lib/outbound/auth";
import { getOutboundEnv, sendDateKey } from "@/lib/outbound/config";
import { dailyCap, usedTodayCount } from "@/lib/outbound/engine";
import { evaluateGuardRails } from "@/lib/outbound/guardrails";
import { meetingStats, wasSent } from "@/lib/outbound/metrics";
import { openStore } from "@/lib/outbound/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/outbound/chat — "Pergunte ao MORK": perguntas livres sobre os
 * dados e as ações do workspace. Sessão obrigatória; leitura sem lock; nada é
 * gravado (consulta não vira atividade). SEM PII no prompt: o contexto usa só
 * agregados, empresas, títulos e resumos (que nascem sem contato pessoal), e a
 * pergunta/histórico passam por redação de e-mails no builder. Em demo:
 * resposta simulada rotulada, sem tocar API externa. Gate humano absoluto:
 * este endpoint apenas responde, nunca executa ação.
 */

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

const PERGUNTA_MAX = 500;
const HISTORICO_MAX = 8;
const TURNO_MAX = 2000;

const DEMO_RESPOSTA = [
  "No demo o funil está assim: 5 interessados, 3 reuniões no radar e 1 proposta de R$ 80 mil aberta.",
  "A ação mais importante seria responder o interessado mais recente (aba Hoje).",
  "(Resposta de demonstração, gerada sem IA.)",
].join(" ");

interface ChatBody {
  demo?: boolean;
  pergunta?: string;
  historico?: Array<{ papel?: string; texto?: string }>;
}

function parseHistorico(raw: ChatBody["historico"]): ConsoleChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => (t?.papel === "voce" || t?.papel === "mork") && typeof t.texto === "string")
    .slice(-HISTORICO_MAX)
    .map((t) => ({ papel: t.papel as ConsoleChatTurn["papel"], texto: (t.texto as string).slice(0, TURNO_MAX) }));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return json(401, { ok: false, code: "unauthorized" });

  const body = (await request.json().catch(() => null)) as ChatBody | null;
  const pergunta = typeof body?.pergunta === "string" ? body.pergunta.trim().slice(0, PERGUNTA_MAX) : "";
  if (!pergunta) return json(400, { ok: false, code: "pergunta_vazia", error: "Escreva a pergunta." });
  const isDemo = body?.demo === true;
  const historico = parseHistorico(body?.historico);

  if (isDemo) {
    return json(200, { ok: true, resposta: DEMO_RESPOSTA, model: "exemplo" });
  }

  if (!aiAvailable()) {
    return json(503, {
      ok: false,
      code: "sem_chave",
      error:
        "Defina OUTBOUND_ANTHROPIC_API_KEY ou OUTBOUND_OPENAI_API_KEY (na Vercel e no .env.local do PC) para ligar o chat do MORK.",
    });
  }

  const env = getOutboundEnv();
  const now = new Date();
  const dateKey = sendDateKey(now, env.utcOffset);
  const store = openStore();
  const [sends, replies, deals, tasks, demands, suppressions, activities, state] = await Promise.all([
    store.sends(),
    store.replies(),
    store.deals(),
    store.tasks(),
    store.demands(),
    store.suppressions(),
    store.agentActivities(),
    store.state(),
  ]);

  const rails = evaluateGuardRails(sends);
  const meetings = meetingStats(deals, replies);
  const fmtBRL = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

  const porEstagio = new Map<string, { qtd: number; valor: number; empresas: string[] }>();
  for (const deal of deals) {
    const bucket = porEstagio.get(deal.stage) ?? { qtd: 0, valor: 0, empresas: [] };
    bucket.qtd += 1;
    bucket.valor += deal.valorEstimado ?? 0;
    if (bucket.empresas.length < 6 && deal.empresa) bucket.empresas.push(deal.empresa);
    porEstagio.set(deal.stage, bucket);
  }

  const tarefasAbertas = tasks
    .filter((t) => t.status === "aberta")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 15);
  const demandasView = demands.filter((d) => d.status === "pendente" || d.status === "em_andamento").slice(0, 10);
  const atividadesRecentes = [...activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);

  // Contexto compacto e SEM PII: agregados, empresas, títulos e resumos.
  const contexto = [
    `Data de hoje: ${dateKey}. Automação: ${state.armed ? "armada" : "desarmada"}${state.breakerTrippedAt ? " · circuit breaker DISPARADO" : ""}.`,
    `Envios: hoje ${usedTodayCount(sends, now, env.utcOffset)}/${dailyCap(state, env, now)} do cap · total enviados ${rails.sent} · entregues ${sends.filter((s) => s.status === "delivered").length} · na fila do Resend ${sends.filter((s) => s.status === "scheduled").length} · bounce ${Math.round(rails.bounceRate * 1000) / 10}%.`,
    `Respostas: ${replies.length} no total · reais (sem fora do escritório) ${replies.filter((r) => r.classification !== "ooo").length} · interessados ${replies.filter((r) => r.classification === "interested").length}.`,
    `Reuniões: ${meetings.geradas} marcadas · ${meetings.realizadas} realizadas. Supressões: ${suppressions.length}.`,
    `Pipeline (${deals.length} negócios): ` +
      [...porEstagio.entries()]
        .map(
          ([estagio, b]) =>
            `${estagio}: ${b.qtd}${b.valor > 0 ? ` (${fmtBRL(b.valor)})` : ""}${b.empresas.length > 0 ? ` [${b.empresas.join(", ")}]` : ""}`,
        )
        .join(" · "),
    `Campanhas: ` +
      campaigns
        .map((def) => {
          const cs = sends.filter((s) => s.campaignSlug === def.slug);
          const cr = replies.filter((r) => r.campaignSlug === def.slug);
          return `${def.industria} (${def.slug}): enviados ${cs.filter(wasSent).length}, respostas ${cr.length}, interessados ${cr.filter((r) => r.classification === "interested").length}`;
        })
        .join(" · "),
    `Tarefas abertas (${tasks.filter((t) => t.status === "aberta").length}): ` +
      (tarefasAbertas.map((t) => `${t.dueDate} ${t.titulo}${t.dueDate < dateKey ? " (VENCIDA)" : ""}`).join(" · ") ||
        "nenhuma"),
    `Demandas do time: ` +
      (demandasView.map((d) => `[${d.status}] ${d.title}`).join(" · ") || "nenhuma pendente ou em andamento"),
    `Últimas ações registradas: ` +
      (atividadesRecentes.map((a) => `${a.at.slice(0, 16)} ${a.actor}: ${a.summary}`).join(" · ") || "nenhuma"),
  ].join("\n");

  try {
    const resposta = await answerConsoleQuestion(contexto, historico, pergunta);
    logger.info("outbound.ai.chat", { chars: pergunta.length });
    return json(200, { ok: true, resposta, model: aiModelLabel() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao responder.";
    logger.warn("outbound.ai.chat_falhou", { message });
    return json(502, { ok: false, code: "ia_falhou", error: message });
  }
}
