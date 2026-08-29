import { createHash } from "node:crypto";
import { SIGNATURE_TEXT, signatureHtml } from "./signature";
import type { CampaignDefinition, CampaignStep, Contact } from "./types";

/**
 * Renderização e lint da copy de outbound (PRD §6).
 * Princípio: e-mail direto, pessoal, texto puro — indistinguível de um e-mail escrito
 * à mão. O lint bloqueia cara de marketing, cara de IA e claims proibidos (PRD §3).
 */

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;
/** Resto de placeholder malformado após o render: `{{nome}` sem fechar, `{nome}` com chave simples etc. */
const BROKEN_PLACEHOLDER_RE = /\{\{|\}\}|\{[\w.]+\}/;

/**
 * Hash estável do conteúdo aprovável de uma campanha (slug + passos). Usado pelo
 * approve/motor para invalidar aprovações quando a copy muda depois do approve.
 */
export function campaignContentHash(def: CampaignDefinition): string {
  const canonical = JSON.stringify({
    slug: def.slug,
    steps: def.steps.map((s) => ({
      id: s.id,
      offsetDays: s.offsetDays,
      subject: s.subject,
      body: s.body,
      withLink: s.withLink ?? false,
    })),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 16);
}

export interface RenderResult {
  value: string;
  missing: string[];
}

/** Variáveis disponíveis: campos do contato + colunas extras do Clay (`custom`). */
export function templateVars(contact: Contact): Record<string, string> {
  const vars: Record<string, string> = { ...contact.custom };
  vars.nome = contact.nome;
  if (contact.sobrenome) vars.sobrenome = contact.sobrenome;
  if (contact.cargo) vars.cargo = contact.cargo;
  if (contact.empresa) vars.empresa = contact.empresa;
  if (contact.industria) vars.industria = contact.industria;
  return vars;
}

export function renderTemplate(template: string, vars: Record<string, string>): RenderResult {
  const missing: string[] = [];
  const value = template.replace(VAR_RE, (_, name: string) => {
    const v = vars[name]?.trim();
    if (!v) {
      missing.push(name);
      return "";
    }
    return v;
  });
  return { value, missing };
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * HTML mínimo espelhando o texto: parágrafos sem estilo, sem imagens, sem cores.
 * Renderiza como e-mail pessoal; existir parte HTML permite open/click tracking do Resend.
 */
export function textToMinimalHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const withLinks = escapeHtml(p).replace(
        /(https?:\/\/[^\s<]+)/g,
        (url) => `<a href="${url}">${url}</a>`,
      );
      return `<p>${withLinks.replace(/\n/g, "<br>")}</p>`;
    });
  return `<div>${paragraphs.join("\n")}</div>`;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

/**
 * Monta o e-mail final de um passo para um contato. Lança se faltar variável
 * (nunca enviar e-mail com buraco de personalização).
 */
export function buildEmail(
  contact: Contact,
  campaign: CampaignDefinition,
  step: CampaignStep,
  opts: { replyTo: string },
): BuiltEmail {
  const vars = templateVars(contact);
  const subject = renderTemplate(step.subject, vars);
  const body = renderTemplate(step.body, vars);
  const missing = [...new Set([...subject.missing, ...body.missing])];
  if (missing.length > 0) {
    throw new Error(
      `Variáveis ausentes para ${contact.email} em ${campaign.slug}/${step.id}: ${missing.join(", ")}`,
    );
  }
  // Placeholder malformado ({{nome} sem fechar, {nome} com chave simples) escaparia
  // do render e chegaria LITERAL ao prospect — nunca enviar.
  const broken =
    subject.value.match(BROKEN_PLACEHOLDER_RE)?.[0] ?? body.value.match(BROKEN_PLACEHOLDER_RE)?.[0];
  if (broken) {
    throw new Error(
      `Placeholder malformado em ${campaign.slug}/${step.id} (sobrou "${broken}" após o render) — corrija o template.`,
    );
  }
  // Assinatura anexada pelo MOTOR (identidade + linha legal LGPD em todo envio) —
  // a copy das campanhas termina na pergunta, sem assinatura própria.
  return {
    subject: subject.value,
    text: `${body.value}\n\n${SIGNATURE_TEXT}`,
    html: `${textToMinimalHtml(body.value)}\n${signatureHtml()}`,
    headers: {
      // Baixo volume (<5k/dia): mailto atende RFC 2369; one-click HTTPS entra com o deploy (ADR).
      "List-Unsubscribe": `<mailto:${opts.replyTo}?subject=descadastro>`,
    },
  };
}

// ─── Lint de copy ────────────────────────────────────────────────────────────

export interface LintIssue {
  level: "error" | "warn";
  rule: string;
  detail: string;
}

/** Claims/posicionamentos proibidos (PRD do site §2 + regras do workspace). */
const FORBIDDEN_TERMS = [
  "nocode",
  "no-code",
  "no code",
  "lowcode",
  "low-code",
  "bubble",
  "chatbot",
  "chat bot",
  "landing page",
  "consultoria gratuita",
  "e-commerce",
  "ecommerce",
  "mvp",
];

/** Vocabulário de e-mail marketing — mata o tom pessoal. */
const MARKETING_TERMS = [
  "imperdível",
  "não perca",
  "oferta especial",
  "promoção",
  "desconto",
  "grátis",
  "gratuito",
  "garantido",
  "garantia de",
  "líder de mercado",
  "melhor do mercado",
  "solução inovadora",
  "inovador",
  "revolucionár",
  "disruptiv",
  "alavanc",
  "sinergia",
  "clique aqui",
  "acesse já",
  "última chance",
  "exclusivo para você",
];

/** Frases-carimbo de IA/mala direta — o teste é: uma pessoa escreveria isso num e-mail curto? */
const AI_TELL_PHRASES = [
  "espero que este e-mail",
  "espero que esteja bem",
  "espero que você esteja",
  "meu nome é",
  "venho por meio",
  "por meio deste",
  "estou entrando em contato",
  "gostaria de apresentar",
  "gostaria de me apresentar",
  "no cenário atual",
  "no mundo de hoje",
  "nos dias de hoje",
  "cada vez mais",
  "nesse sentido",
  "além disso,",
  "vale ressaltar",
  "é importante destacar",
  "não hesite em",
  "fico à disposição para",
  "estou à disposição para",
  "aguardo seu retorno",
  "atenciosamente",
  "cordialmente",
  "prezado",
  "prezada",
];

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export interface LintOptions {
  /**
   * Template do assunto (com {{vars}}). Quando presente, a checagem de CAIXA ALTA
   * roda sobre o template com as variáveis removidas — nome de empresa em caps
   * ("SITECH", "CAZ CONSTRUTORA") vindo de {{empresa}} não é gritaria de marketing.
   */
  subjectTemplate?: string;
}

/**
 * Lint do e-mail RENDERIZADO (sem {{vars}} pendentes). Errors bloqueiam envio;
 * warns pedem revisão humana.
 */
export function lintEmail(subject: string, body: string, opts: LintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const lowerBody = body.toLowerCase();
  const lowerSubject = subject.toLowerCase();
  const all = `${lowerSubject}\n${lowerBody}`;

  for (const term of FORBIDDEN_TERMS) {
    if (all.includes(term)) {
      issues.push({ level: "error", rule: "claim-proibido", detail: `termo vetado: "${term}"` });
    }
  }
  for (const term of MARKETING_TERMS) {
    if (all.includes(term)) {
      issues.push({ level: "error", rule: "tom-marketing", detail: `vocabulário de marketing: "${term}"` });
    }
  }
  for (const phrase of AI_TELL_PHRASES) {
    if (all.includes(phrase)) {
      issues.push({ level: "error", rule: "cara-de-ia", detail: `frase-carimbo: "${phrase}"` });
    }
  }

  const words = countWords(body);
  if (words > 140) {
    issues.push({ level: "error", rule: "tamanho", detail: `${words} palavras (máx. 140; alvo 50–120)` });
  } else if (words < 30) {
    issues.push({ level: "warn", rule: "tamanho", detail: `${words} palavras (curto demais?)` });
  } else if (words > 120) {
    issues.push({ level: "warn", rule: "tamanho", detail: `${words} palavras (alvo 50–120)` });
  }

  if (/<[a-z][\s\S]*>/i.test(body)) {
    issues.push({ level: "error", rule: "html", detail: "corpo deve ser texto puro (HTML é gerado)" });
  }

  const brokenPlaceholder = subject.match(BROKEN_PLACEHOLDER_RE)?.[0] ?? body.match(BROKEN_PLACEHOLDER_RE)?.[0];
  if (brokenPlaceholder) {
    issues.push({
      level: "error",
      rule: "placeholder",
      detail: `placeholder malformado sobrou no texto: "${brokenPlaceholder}" (use {{variavel}} com chaves duplas fechadas)`,
    });
  }

  const exclamations = (body.match(/!/g) ?? []).length + (subject.match(/!/g) ?? []).length;
  if (exclamations > 1) {
    issues.push({ level: "error", rule: "tom-marketing", detail: `${exclamations} exclamações (máx. 1)` });
  }

  // Decisão do usuário (2026-08-29): travessão é PROIBIDO — "esse traço é muito cara de IA".
  const dashes = (`${subject}\n${body}`.match(/[—–]/g) ?? []).length;
  if (dashes > 0) {
    issues.push({
      level: "error",
      rule: "cara-de-ia",
      detail: `${dashes} travessão(ões) — proibido (reescreva com ponto, vírgula ou dois-pontos)`,
    });
  }

  // Números/percentuais/moeda: só com fonte citada ou rótulo de exemplo/simulação (PRD §6).
  const hasNumbersClaim = /(\d+\s*%|r\$\s*\d|us\$\s*\d|\d+\s*[x×])/i.test(all);
  const hasSourceOrLabel = /(mckinsey|stanford|idc|exemplo|simula|ilustrativ)/i.test(all);
  if (hasNumbersClaim && !hasSourceOrLabel) {
    issues.push({
      level: "error",
      rule: "claim-sem-fonte",
      detail: "número/percentual/valor sem fonte citada nem rótulo de exemplo/simulação",
    });
  }

  // Assunto: curto, natural, sem cara de campanha.
  if (subject.length > 60) {
    issues.push({ level: "warn", rule: "assunto", detail: `${subject.length} caracteres (alvo ≤ 60)` });
  }
  if (/\p{Extended_Pictographic}/u.test(subject)) {
    issues.push({ level: "error", rule: "assunto", detail: "emoji no assunto" });
  }
  const capsSource = opts.subjectTemplate !== undefined ? opts.subjectTemplate.replace(VAR_RE, "") : subject;
  const capsWords = capsSource
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w === w.toUpperCase() && /[A-ZÀ-Ü]/.test(w));
  if (capsWords.length > 0) {
    issues.push({ level: "error", rule: "assunto", detail: `palavra em caixa alta: ${capsWords.join(", ")}` });
  }

  return issues;
}

export function lintErrors(issues: LintIssue[]): LintIssue[] {
  return issues.filter((i) => i.level === "error");
}
