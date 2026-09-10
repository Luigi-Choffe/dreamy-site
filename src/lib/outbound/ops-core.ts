import { randomUUID } from "node:crypto";
import type { Contact, Enrollment, Reply, ReplyClass, SendRecord } from "./types";

/**
 * Núcleo puro das operações de campanha e resposta (PRD-EMAIL-OUTBOUND §5, §7, §14):
 * seleção de contatos para enroll, registro de reply (com parada da sequência) e
 * opt-out. Sem I/O — recebe as coleções do store e devolve mutações prontas para
 * salvar; quem persiste são os CLIs de `scripts/outbound/`.
 */

/** Normaliza indústria para comparação: minúsculas, sem acento, espaços colapsados. */
export function normalizeIndustria(value: string): string {
  return (
    value
      .normalize("NFD")
      // a classe abaixo é o intervalo U+0300–U+036F (combining diacritical marks)
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
  );
}

/**
 * Sufixos societários no FIM do nome (precedidos de espaço, hífen ou vírgula):
 * "Acme Ltda.", "Acme S.A.", "Acme S/A", "Acme Comércio Ltda ME". O separador é
 * obrigatório para não comer o fim de palavras ("Melissa" não vira "Melis").
 */
const SUFIXO_SOCIETARIO = /(?:(?:\s+|\s*[-,]\s*)(?:ltda|limitada|s\.?a\.?|s\/a|eireli|epp|me)\.?)+$/;

/**
 * Chave de comparação de empresa: minúsculas, sem acento, sem sufixo societário,
 * espaços colapsados. Normalização SIMPLES, sem fuzzy: "Pierserv" e "PierServ
 * Logística Promocional" continuam sendo empresas diferentes. Vazio quando o
 * contato não tem empresa.
 */
export function normalizeEmpresa(value: string | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(SUFIXO_SOCIETARIO, "")
    .trim();
}

/** Primeiro nome do contato ("Maria Silva" → "Maria"); vazio se não houver nome. */
function primeiroNome(contact: Contact): string {
  return contact.nome.trim().split(/\s+/)[0] ?? "";
}

/**
 * Colegas do contato na campanha: primeiros nomes dos OUTROS contatos da mesma
 * empresa (`normalizeEmpresa`) com enrollment ATIVO na mesma campanha, que ainda
 * podem receber e-mail (contato ativo e verificado). Ordem estável: createdAt do
 * enrollment, depois id do contato. É o que o MORK usa para preencher
 * `{{colegas}}` por contato antes do envio: só cita quem de fato vai receber.
 */
export function colegasNaCampanha(
  contact: Contact,
  contacts: Contact[],
  enrollments: Enrollment[],
  campaignSlug: string,
): string[] {
  const empresa = normalizeEmpresa(contact.empresa);
  if (empresa === "") return [];
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  return enrollments
    .filter((e) => e.status === "active" && e.campaignSlug === campaignSlug && e.contactId !== contact.id)
    .map((e) => ({ enrollment: e, colega: contactsById.get(e.contactId) }))
    .filter(
      (x): x is { enrollment: Enrollment; colega: Contact } =>
        x.colega !== undefined &&
        x.colega.status === "active" &&
        x.colega.verification === "ok" &&
        normalizeEmpresa(x.colega.empresa) === empresa,
    )
    .sort(
      (a, b) => a.enrollment.createdAt.localeCompare(b.enrollment.createdAt) || a.colega.id.localeCompare(b.colega.id),
    )
    .map((x) => primeiroNome(x.colega))
    .filter((nome) => nome !== "");
}

export interface EnrollmentSelectionInput {
  contacts: Contact[];
  enrollments: Enrollment[];
  /** E-mails (normalizados) presentes na supressão global. */
  suppressed: ReadonlySet<string>;
  campaignSlug: string;
  /** Indústria alvo (a da campanha ou override do operador). */
  industria: string;
  limit?: number;
}

export interface EnrollmentSelectionSkipped {
  statusNaoAtivo: number;
  verificacaoNaoOk: number;
  industriaDiferente: number;
  suprimido: number;
  /** Já tem enrollment NESTA campanha (qualquer status) — nunca reentra. */
  jaNaCampanha: number;
  /** Sequência ativa em outra campanha — um contato nunca está em duas ao mesmo tempo. */
  ativoEmOutraCampanha: number;
  alemDoLimite: number;
}

export interface EnrollmentSelection {
  eligible: Contact[];
  skipped: EnrollmentSelectionSkipped;
}

export function selectEnrollmentCandidates(input: EnrollmentSelectionInput): EnrollmentSelection {
  const alvo = normalizeIndustria(input.industria);
  const naCampanha = new Set(
    input.enrollments.filter((e) => e.campaignSlug === input.campaignSlug).map((e) => e.contactId),
  );
  const ativoEmOutra = new Set(
    input.enrollments
      .filter((e) => e.status === "active" && e.campaignSlug !== input.campaignSlug)
      .map((e) => e.contactId),
  );
  const skipped: EnrollmentSelectionSkipped = {
    statusNaoAtivo: 0,
    verificacaoNaoOk: 0,
    industriaDiferente: 0,
    suprimido: 0,
    jaNaCampanha: 0,
    ativoEmOutraCampanha: 0,
    alemDoLimite: 0,
  };
  const eligible: Contact[] = [];
  for (const contact of input.contacts) {
    if (contact.status !== "active") {
      skipped.statusNaoAtivo++;
      continue;
    }
    if (contact.verification !== "ok") {
      skipped.verificacaoNaoOk++;
      continue;
    }
    if (!contact.industria || normalizeIndustria(contact.industria) !== alvo) {
      skipped.industriaDiferente++;
      continue;
    }
    if (input.suppressed.has(contact.email.trim().toLowerCase())) {
      skipped.suprimido++;
      continue;
    }
    if (naCampanha.has(contact.id)) {
      skipped.jaNaCampanha++;
      continue;
    }
    if (ativoEmOutra.has(contact.id)) {
      skipped.ativoEmOutraCampanha++;
      continue;
    }
    if (input.limit !== undefined && eligible.length >= input.limit) {
      skipped.alemDoLimite++;
      continue;
    }
    eligible.push(contact);
  }
  return { eligible, skipped };
}

export function buildEnrollment(contact: Contact, campaignSlug: string, now: Date = new Date()): Enrollment {
  return {
    id: randomUUID(),
    contactId: contact.id,
    campaignSlug,
    status: "active",
    nextStep: 0,
    createdAt: now.toISOString(),
  };
}

export interface ApplyReplyInput {
  contact: Contact;
  /** Todos os enrollments do store (a função devolve a lista completa atualizada). */
  enrollments: Enrollment[];
  classification: ReplyClass;
  notes?: string;
  receivedAt: string;
  /** Override de atribuição — necessário quando o contato não tem enrollment. */
  campaignSlug?: string;
}

export interface ApplyReplyResult {
  reply: Reply;
  enrollments: Enrollment[];
  stoppedEnrollmentIds: string[];
  campaignSlug: string;
}

/**
 * Registra a resposta e para as sequências ativas do contato (status `replied`,
 * stopReason `reply`). Exceção do PRD §14: `ooo` não é resposta real — a sequência
 * continua. A campanha da resposta vem do enrollment ativo (ou do mais recente).
 */
export function applyReply(input: ApplyReplyInput, now: Date = new Date()): ApplyReplyResult {
  const own = input.enrollments.filter((e) => e.contactId === input.contact.id);
  const active = own.filter((e) => e.status === "active");
  const slug =
    input.campaignSlug ??
    active[0]?.campaignSlug ??
    [...own].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)?.campaignSlug;
  if (!slug) {
    throw new Error(
      `Contato ${input.contact.id} não tem enrollment em nenhuma campanha — use --campaign <slug> para atribuir a resposta.`,
    );
  }
  const stoppedEnrollmentIds: string[] = [];
  const enrollments = input.enrollments.map((e) => {
    if (input.classification === "ooo") return e; // ooo não conta como resposta real (PRD §14)
    if (e.contactId !== input.contact.id || e.status !== "active") return e;
    stoppedEnrollmentIds.push(e.id);
    return { ...e, status: "replied" as const, stopReason: "reply" as const };
  });
  const reply: Reply = {
    id: randomUUID(),
    contactId: input.contact.id,
    campaignSlug: slug,
    classification: input.classification,
    notes: input.notes,
    receivedAt: input.receivedAt,
    recordedAt: now.toISOString(),
  };
  return { reply, enrollments, stoppedEnrollmentIds, campaignSlug: slug };
}

/** Opt-out (--suppress do reply, PRD §15): para toda sequência ativa do contato. */
export function applyOptOut(
  enrollments: Enrollment[],
  contactId: string,
): { enrollments: Enrollment[]; stoppedEnrollmentIds: string[] } {
  const stoppedEnrollmentIds: string[] = [];
  const updated = enrollments.map((e) => {
    if (e.contactId !== contactId || e.status !== "active") return e;
    stoppedEnrollmentIds.push(e.id);
    return { ...e, status: "stopped" as const, stopReason: "unsubscribe" as const };
  });
  return { enrollments: updated, stoppedEnrollmentIds };
}

/**
 * Atribui uma resposta ao último passo enviado ao contato antes de ela chegar
 * (funil por passo do report). Sem envio anterior → undefined.
 */
export function replyStepId(sends: SendRecord[], reply: Reply): string | undefined {
  const own = sends
    .filter((s) => s.contactId === reply.contactId && s.campaignSlug === reply.campaignSlug)
    .filter((s) => s.status !== "scheduled" && s.status !== "canceled" && s.status !== "failed")
    .map((s) => ({ stepId: s.stepId, at: s.sentAt ?? s.scheduledAt ?? "" }))
    .sort((a, b) => a.at.localeCompare(b.at));
  if (own.length === 0) return undefined;
  const before = own.filter((s) => s.at !== "" && s.at <= reply.receivedAt);
  return (before.at(-1) ?? own.at(-1))?.stepId;
}
