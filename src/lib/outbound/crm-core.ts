import { randomUUID } from "node:crypto";
import { isBusinessDay, sendDateKey } from "./config";
import type {
  Contact,
  CrmNote,
  CrmTask,
  Deal,
  DealStage,
  Enrollment,
  OutboundEvent,
  Reply,
  ReplyClass,
  SendRecord,
} from "./types";

/**
 * Núcleo puro do CRM piloto (PRD-EMAIL-OUTBOUND §29). Sem I/O: recebe as coleções
 * do store e devolve listas novas prontas para salvar. NUNCA escreve nas coleções
 * do motor (contacts/enrollments/sends/replies saem intactos daqui).
 *
 * Regras de estágio:
 * - "novo"/"contatado"/"respondeu" são AUTOMÁTICOS (reconcileDeals), andam só
 *   para frente e nunca rebaixam um estágio manual;
 * - de "reuniao_marcada" em diante o movimento é exclusivamente humano
 *   (applyStageMove), com piso no autoStage.
 */

export const DEAL_STAGES: DealStage[] = [
  "novo",
  "contatado",
  "respondeu",
  "reuniao_marcada",
  "reuniao_realizada",
  "proposta",
  "ganho",
  "perdido",
];

const STAGE_ORDER: Record<DealStage, number> = {
  novo: 0,
  contatado: 1,
  respondeu: 2,
  reuniao_marcada: 3,
  reuniao_realizada: 4,
  proposta: 5,
  ganho: 6,
  perdido: 7,
};

export function stageIndex(stage: DealStage): number {
  return STAGE_ORDER[stage];
}

export type AutoStage = "novo" | "contatado" | "respondeu";

const AUTO_MAX_INDEX = STAGE_ORDER.respondeu;

export function isAutoStage(stage: DealStage): stage is AutoStage {
  return STAGE_ORDER[stage] <= AUTO_MAX_INDEX;
}

/** Send que saiu de fato para o contato (contato foi contatado). */
function contactedByOutbound(send: SendRecord): boolean {
  return send.status === "sent" || send.status === "delivered" || send.status === "complained";
}

/** Resposta real (ooo não conta — PRD §14). */
function isRealReply(reply: Reply): boolean {
  return reply.classification !== "ooo";
}

export interface ReconcileInput {
  contacts: Contact[];
  enrollments: Enrollment[];
  sends: SendRecord[];
  replies: Reply[];
  deals: Deal[];
}

export interface ReconcileResult {
  /** Lista COMPLETA atualizada (cópias — a entrada não é mutada). */
  deals: Deal[];
  created: number;
  advanced: number;
}

/**
 * Deriva/avança negócios a partir do outbound. Idempotente e forward-only:
 * - contato com enrollment ativo (ou com resposta real) e sem negócio → cria;
 * - 1º send que saiu → "contatado"; 1ª resposta real → "respondeu";
 * - só avança estágios automáticos; estágio manual nunca é rebaixado
 *   (o piso fica registrado em `autoStage`).
 */
export function reconcileDeals(input: ReconcileInput, now: Date = new Date()): ReconcileResult {
  const at = now.toISOString();
  const deals = input.deals.map((d) => ({ ...d, stageHistory: [...d.stageHistory] }));
  const byContact = new Map(deals.map((d) => [d.contactId, d]));
  const contactById = new Map(input.contacts.map((c) => [c.id, c]));

  const enrollmentsByContact = new Map<string, Enrollment[]>();
  for (const e of input.enrollments) {
    const list = enrollmentsByContact.get(e.contactId) ?? [];
    list.push(e);
    enrollmentsByContact.set(e.contactId, list);
  }
  const contacted = new Set(input.sends.filter(contactedByOutbound).map((s) => s.contactId));
  const replied = new Set(input.replies.filter(isRealReply).map((r) => r.contactId));

  let created = 0;
  let advanced = 0;

  for (const [contactId, enrollments] of enrollmentsByContact) {
    const autoStage: AutoStage = replied.has(contactId) ? "respondeu" : contacted.has(contactId) ? "contatado" : "novo";
    const existing = byContact.get(contactId);

    if (!existing) {
      // Cria só para funil vivo: sequência ativa OU resposta real. Enrollment
      // parado sem resposta (bounce, opt-out) não vira negócio novo.
      const alive = enrollments.some((e) => e.status === "active") || replied.has(contactId);
      if (!alive) continue;
      const contact = contactById.get(contactId);
      if (!contact || contact.status === "excluded") continue;
      const latest = [...enrollments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
      const history = [{ stage: "novo" as DealStage, at, by: "sistema" }];
      if (autoStage !== "novo") history.push({ stage: autoStage, at, by: "sistema" });
      deals.push({
        id: randomUUID(),
        contactId,
        campaignSlug: latest?.campaignSlug,
        empresa: contact.empresa,
        stage: autoStage,
        autoStage,
        stageHistory: history,
        stageChangedAt: at,
        stageChangedBy: "sistema",
        createdAt: at,
      });
      created += 1;
      continue;
    }

    // Piso automático sempre acompanha os fatos (forward-only).
    const floorBefore = existing.autoStage ?? "novo";
    if (STAGE_ORDER[autoStage] > STAGE_ORDER[floorBefore]) existing.autoStage = autoStage;

    // Só empurra o ESTÁGIO se o atual ainda é automático; manual fica intacto.
    if (isAutoStage(existing.stage) && STAGE_ORDER[autoStage] > STAGE_ORDER[existing.stage]) {
      existing.stage = autoStage;
      existing.stageChangedAt = at;
      existing.stageChangedBy = "sistema";
      existing.stageHistory.push({ stage: autoStage, at, by: "sistema" });
      advanced += 1;
    }

    if (!existing.empresa) existing.empresa = contactById.get(contactId)?.empresa;
  }

  return { deals, created, advanced };
}

export interface StageMoveInput {
  to: DealStage;
  /** E-mail da sessão, "mork" ou "sistema". */
  by: string;
  motivo?: string;
  /** ISO com offset; obrigatório ao mover para "reuniao_marcada" (se ainda não houver). */
  reuniaoEm?: string;
  valorEstimado?: number;
  now?: Date;
}

/**
 * Movimento manual de estágio. Valida regras e MUTA o deal recebido (chame com a
 * cópia da coleção que vai salvar). Retorna false quando não há nada a mudar.
 */
export function applyStageMove(deal: Deal, input: StageMoveInput): boolean {
  const at = (input.now ?? new Date()).toISOString();
  if (!DEAL_STAGES.includes(input.to)) throw new Error(`Estágio inválido: "${input.to}".`);

  if (typeof input.valorEstimado === "number") {
    if (!Number.isFinite(input.valorEstimado) || input.valorEstimado < 0) {
      throw new Error("Valor estimado inválido (use um número em reais, sem centavos).");
    }
    deal.valorEstimado = input.valorEstimado;
  }

  if (input.to === deal.stage) return false;

  const floor = deal.autoStage ?? "novo";
  if (STAGE_ORDER[input.to] < STAGE_ORDER[floor]) {
    throw new Error(
      `O outbound já registrou "${floor}" para este contato: o negócio não pode voltar para "${input.to}".`,
    );
  }
  if (input.to === "perdido" && !input.motivo?.trim()) {
    throw new Error('Mover para "perdido" exige o motivo.');
  }
  if (input.to === "reuniao_marcada") {
    const quando = input.reuniaoEm?.trim() || deal.reuniaoEm;
    if (!quando || Number.isNaN(Date.parse(quando))) {
      throw new Error('Mover para "reuniao_marcada" exige a data/hora da reunião.');
    }
    deal.reuniaoEm = quando;
  } else if (input.reuniaoEm?.trim()) {
    if (Number.isNaN(Date.parse(input.reuniaoEm))) throw new Error("Data/hora da reunião inválida.");
    deal.reuniaoEm = input.reuniaoEm.trim();
  }
  if (input.to === "perdido") deal.lostReason = input.motivo?.trim();

  deal.stage = input.to;
  deal.stageChangedAt = at;
  deal.stageChangedBy = input.by;
  deal.stageHistory.push({ stage: input.to, at, by: input.by, motivo: input.motivo?.trim() || undefined });
  return true;
}

export interface ManualDealInput {
  contact: Contact;
  by: string;
  valorEstimado?: number;
  now?: Date;
}

/** Negócio criado à mão (prospect fora do outbound). */
export function buildManualDeal(input: ManualDealInput): Deal {
  const at = (input.now ?? new Date()).toISOString();
  return {
    id: randomUUID(),
    contactId: input.contact.id,
    empresa: input.contact.empresa,
    stage: "novo",
    valorEstimado: input.valorEstimado,
    stageHistory: [{ stage: "novo", at, by: input.by }],
    stageChangedAt: at,
    stageChangedBy: input.by,
    createdAt: at,
  };
}

/* ─── Tarefas e follow-up ─────────────────────────────────────────────────── */

/** Próximo dia útil (YYYY-MM-DD) DEPOIS de `from`, no fuso de envio. */
export function nextBusinessDay(from: Date, utcOffset: string): string {
  let t = from.getTime();
  do {
    t += 86_400_000;
  } while (!isBusinessDay(new Date(t), utcOffset));
  return sendDateKey(new Date(t), utcOffset);
}

export interface FollowUpInput {
  contactId: string;
  dealId?: string;
  by?: string;
  now?: Date;
  utcOffset?: string;
}

/**
 * Regra do interessado: garante UMA tarefa aberta de follow-up para o contato.
 * Já existe tarefa aberta → null (não duplica). Tarefa concluída não bloqueia.
 */
export function ensureFollowUpTask(tasks: CrmTask[], input: FollowUpInput): CrmTask | null {
  if (tasks.some((t) => t.status === "aberta" && t.contactId === input.contactId)) return null;
  const now = input.now ?? new Date();
  return {
    id: randomUUID(),
    titulo: "Responder e propor reunião",
    contactId: input.contactId,
    dealId: input.dealId,
    dueDate: nextBusinessDay(now, input.utcOffset ?? "-03:00"),
    status: "aberta",
    origin: "regra",
    createdBy: input.by ?? "sistema",
    createdAt: now.toISOString(),
  };
}

/** Respostas "interested" (a mais recente por contato) sem tarefa aberta. */
export function pendingFollowUps(replies: Reply[], tasks: CrmTask[]): Reply[] {
  const openByContact = new Set(
    tasks.filter((t) => t.status === "aberta" && t.contactId).map((t) => t.contactId as string),
  );
  const latest = new Map<string, Reply>();
  for (const r of replies) {
    if (r.classification !== "interested") continue;
    const prev = latest.get(r.contactId);
    if (!prev || r.receivedAt > prev.receivedAt) latest.set(r.contactId, r);
  }
  return [...latest.values()].filter((r) => !openByContact.has(r.contactId));
}

/* ─── Timeline da conta ───────────────────────────────────────────────────── */

const SEND_STATUS_TL: Record<SendRecord["status"], string> = {
  pending: "pendente",
  scheduled: "agendado",
  sent: "enviado",
  delivered: "entregue",
  bounced: "bounce",
  complained: "complaint",
  failed: "falha",
  canceled: "cancelado",
};

/** "sent" fica de fora: o próprio envio já conta a história. */
const EVENT_TL: Partial<Record<OutboundEvent["type"], string>> = {
  delivered: "entregue",
  delivery_delayed: "entrega atrasada",
  bounced: "bounce",
  complained: "complaint",
  opened: "abertura",
  clicked: "clique",
  failed: "falha",
  canceled: "cancelado",
  suppressed: "suprimido",
};

const REPLY_TL: Record<ReplyClass, string> = {
  interested: "interessado",
  not_now: "agora não",
  referral: "indicação",
  negative: "negativa",
  ooo: "fora do escritório",
  other: "outra",
};

const STAGE_TL: Record<DealStage, string> = {
  novo: "novo",
  contatado: "contatado",
  respondeu: "respondeu",
  reuniao_marcada: "reunião marcada",
  reuniao_realizada: "reunião realizada",
  proposta: "proposta",
  ganho: "ganho",
  perdido: "perdido",
};

export interface TimelineItem {
  at: string;
  kind: "envio" | "evento" | "resposta" | "nota" | "tarefa" | "estagio";
  label: string;
  detail?: string;
}

export interface AccountTimelineInput {
  contactId: string;
  sends: SendRecord[];
  events: OutboundEvent[];
  replies: Reply[];
  notes: CrmNote[];
  tasks: CrmTask[];
  deal?: Deal;
}

/** Linha do tempo unificada da conta, mais recente primeiro. Pura, sem PII de e-mail. */
export function buildAccountTimeline(input: AccountTimelineInput): TimelineItem[] {
  const items: TimelineItem[] = [];
  const own = input.sends.filter((s) => s.contactId === input.contactId);
  const ownSendIds = new Set(own.map((s) => s.id));
  for (const s of own) {
    const at = s.sentAt ?? s.scheduledAt;
    if (!at) continue;
    items.push({ at, kind: "envio", label: `e-mail ${s.stepId}: ${SEND_STATUS_TL[s.status]}` });
  }
  for (const e of input.events) {
    if (!ownSendIds.has(e.sendId)) continue;
    const label = EVENT_TL[e.type];
    if (!label) continue;
    items.push({ at: e.occurredAt, kind: "evento", label });
  }
  for (const r of input.replies) {
    if (r.contactId !== input.contactId) continue;
    items.push({
      at: r.receivedAt,
      kind: "resposta",
      label: `resposta: ${REPLY_TL[r.classification]}`,
      detail: r.notes,
    });
  }
  for (const n of input.notes) {
    if (n.contactId !== input.contactId) continue;
    items.push({ at: n.createdAt, kind: "nota", label: `nota (${n.authorEmail})`, detail: n.body });
  }
  for (const t of input.tasks) {
    if (t.contactId !== input.contactId) continue;
    const suffix = t.status === "aberta" ? `vence ${t.dueDate}` : t.status;
    items.push({ at: t.createdAt, kind: "tarefa", label: `tarefa: ${t.titulo}`, detail: suffix });
  }
  if (input.deal) {
    for (const h of input.deal.stageHistory) {
      items.push({
        at: h.at,
        kind: "estagio",
        label: `negócio: ${STAGE_TL[h.stage]}`,
        detail: h.motivo ? `${h.by} · ${h.motivo}` : h.by,
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
