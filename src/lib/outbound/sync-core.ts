import type { OutboundEvent, OutboundEventType, SendRecord, SendStatus, StopReason, SuppressionReason } from "./types";

/**
 * Núcleo puro do sync por polling (PRD-EMAIL-OUTBOUND §13/§21 adaptado à V1 local,
 * sem webhooks): traduz o `last_event` do `GET /emails/:id` do Resend em transição
 * de status, eventos e efeitos colaterais (supressão, parada de enrollment, circuit
 * breaker global). Sem I/O — quem aplica os efeitos é `scripts/outbound/sync.ts`.
 */

/** Sends entregues continuam sendo consultados por este prazo (opened/clicked/bounce tardio). */
export const DELIVERED_POLL_WINDOW_DAYS = 30;

/** Status finais — sync nunca os altera (não há volta). */
const TERMINAL_STATUSES: ReadonlySet<SendStatus> = new Set(["bounced", "complained", "failed", "canceled"]);

/** Progresso normal do ciclo de vida — a transição só anda para a frente. */
const STATUS_RANK: Record<string, number> = { scheduled: 0, sent: 1, delivered: 2 };

export function isTerminalSendStatus(status: SendStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export interface LastEventMapping {
  sendStatus?: SendStatus;
  eventType?: OutboundEventType;
  opened?: boolean;
  clicked?: boolean;
}

/**
 * Mapeia o `last_event` do Resend para o domínio. `opened`/`clicked` NÃO carregam
 * status: nunca regridem um send `delivered` — só marcam flag e evento (a promoção
 * implícita scheduled/sent → delivered é decidida no `applySync`).
 */
export function mapLastEvent(lastEvent: string | null): LastEventMapping {
  switch (lastEvent) {
    case "scheduled":
      return { sendStatus: "scheduled" };
    case "sent":
      return { sendStatus: "sent", eventType: "sent" };
    case "delivered":
      return { sendStatus: "delivered", eventType: "delivered" };
    case "delivery_delayed":
      return { eventType: "delivery_delayed" };
    case "bounced":
      return { sendStatus: "bounced", eventType: "bounced" };
    case "complained":
      return { sendStatus: "complained", eventType: "complained" };
    case "opened":
      return { eventType: "opened", opened: true };
    case "clicked":
      return { eventType: "clicked", clicked: true };
    case "canceled":
      return { sendStatus: "canceled", eventType: "canceled" };
    case "failed":
      return { sendStatus: "failed", eventType: "failed" };
    default:
      // null ou evento novo/desconhecido do Resend: não inventar transição.
      return {};
  }
}

function canTransition(from: SendStatus, to: SendStatus): boolean {
  if (from === to) return false;
  if (TERMINAL_STATUSES.has(from)) return false;
  if (TERMINAL_STATUSES.has(to)) return true;
  return (STATUS_RANK[to] ?? -1) > (STATUS_RANK[from] ?? -1);
}

/** Evento pronto para `store.appendEvent` (id/recordedAt são do store). */
export type SyncEventDraft = Omit<OutboundEvent, "id" | "recordedAt">;

export interface ApplySyncResult {
  /** Cópia atualizada do send (o original não é mutado). */
  send: SendRecord;
  /** Houve mudança de status ou de flag (para o relatório do CLI). */
  changed: boolean;
  /** Eventos a registrar — dedupe por sourceKey é responsabilidade do store. */
  events: SyncEventDraft[];
  suppression?: { email: string; reason: SuppressionReason };
  stopEnrollment?: StopReason;
  /** Complaint pausa TODAS as campanhas (PRD §21: em volume de rampa, 1 já é > 0,1%). */
  tripGlobalBreaker?: boolean;
}

export function applySync(
  send: SendRecord,
  status: { last_event: string | null },
  contactEmail: string,
  now: Date = new Date(),
): ApplySyncResult {
  const mapping = mapLastEvent(status.last_event);
  const next: SendRecord = { ...send };
  const events: SyncEventDraft[] = [];
  let changed = false;

  const applyStatus = (target: SendStatus) => {
    if (!canTransition(next.status, target)) return;
    next.status = target;
    if ((target === "sent" || target === "delivered") && !next.sentAt) next.sentAt = now.toISOString();
    changed = true;
  };

  if (mapping.sendStatus) applyStatus(mapping.sendStatus);
  // Abertura/clique implicam entrega: promovem scheduled/sent a delivered, nunca regridem.
  if (mapping.opened || mapping.clicked) applyStatus("delivered");
  if (mapping.opened && !next.opened) {
    next.opened = true;
    changed = true;
  }
  if (mapping.clicked && !next.clicked) {
    next.clicked = true;
    changed = true;
  }

  if (mapping.eventType && send.resendEmailId && status.last_event) {
    events.push({
      sendId: send.id,
      campaignSlug: send.campaignSlug,
      type: mapping.eventType,
      sourceKey: `sync:${send.resendEmailId}:${status.last_event}`,
      occurredAt: now.toISOString(),
    });
  }

  const result: ApplySyncResult = { send: next, changed, events };
  if (status.last_event === "bounced") {
    result.suppression = { email: contactEmail, reason: "hard_bounce" };
    result.stopEnrollment = "bounce";
  } else if (status.last_event === "complained") {
    result.suppression = { email: contactEmail, reason: "complaint" };
    result.stopEnrollment = "complaint";
    result.tripGlobalBreaker = true;
  }
  return result;
}

/**
 * Send ainda vale consulta? Não-terminais (scheduled/sent) sempre; delivered por
 * até 30 dias após o envio, para capturar opened/clicked/bounce tardio.
 */
export function isPollable(send: SendRecord, now: Date): boolean {
  if (!send.resendEmailId) return false;
  if (send.status === "scheduled" || send.status === "sent") return true;
  if (send.status !== "delivered") return false;
  const ref = send.sentAt ?? send.scheduledAt;
  if (!ref) return true;
  return now.getTime() - new Date(ref).getTime() <= DELIVERED_POLL_WINDOW_DAYS * 86_400_000;
}

export function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
