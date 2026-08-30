import { sendDateKey } from "./config";
import { evaluateGuardRails, type GuardRailStatus } from "./guardrails";
import { replyStepId } from "./ops-core";
import type {
  CampaignDefinition,
  Contact,
  ContactStatus,
  Deal,
  Enrollment,
  Reply,
  ReplyClass,
  SendRecord,
  VerificationStatus,
} from "./types";

/**
 * Agregações puras para o console (`/interno/outbound`) e relatórios.
 * Sem I/O — recebem as coleções do store e devolvem números prontos para exibir.
 */

/** Send que saiu de fato (delivered/bounced/complained implicam envio). */
export function wasSent(send: SendRecord): boolean {
  return (
    send.status === "sent" || send.status === "delivered" || send.status === "bounced" || send.status === "complained"
  );
}

export interface CampaignMetrics {
  slug: string;
  enrollmentsTotal: number;
  enrollmentsActive: number;
  scheduled: number;
  pending: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  repliesByClass: Map<ReplyClass, number>;
  repliesTotal: number;
  interested: number;
  unsubscribes: number;
  rails: GuardRailStatus;
}

export function campaignMetrics(
  slug: string,
  data: { sends: SendRecord[]; enrollments: Enrollment[]; replies: Reply[] },
): CampaignMetrics {
  const sends = data.sends.filter((s) => s.campaignSlug === slug);
  const enrollments = data.enrollments.filter((e) => e.campaignSlug === slug);
  const replies = data.replies.filter((r) => r.campaignSlug === slug);
  const repliesByClass = new Map<ReplyClass, number>();
  for (const r of replies) repliesByClass.set(r.classification, (repliesByClass.get(r.classification) ?? 0) + 1);
  return {
    slug,
    enrollmentsTotal: enrollments.length,
    enrollmentsActive: enrollments.filter((e) => e.status === "active").length,
    scheduled: sends.filter((s) => s.status === "scheduled").length,
    pending: sends.filter((s) => s.status === "pending").length,
    sent: sends.filter(wasSent).length,
    delivered: sends.filter((s) => s.status === "delivered").length,
    opened: sends.filter((s) => s.opened).length,
    clicked: sends.filter((s) => s.clicked).length,
    repliesByClass,
    repliesTotal: replies.length,
    interested: repliesByClass.get("interested") ?? 0,
    unsubscribes: enrollments.filter((e) => e.stopReason === "unsubscribe").length,
    rails: evaluateGuardRails(data.sends, slug),
  };
}

export interface StepFunnelRow {
  stepId: string;
  /** Enrollments que já passaram (ou passarão) por este passo. */
  planned: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replies: number;
}

export function stepFunnel(
  def: CampaignDefinition,
  data: { sends: SendRecord[]; enrollments: Enrollment[]; replies: Reply[] },
): StepFunnelRow[] {
  const sends = data.sends.filter((s) => s.campaignSlug === def.slug);
  const enrollments = data.enrollments.filter((e) => e.campaignSlug === def.slug);
  const replies = data.replies.filter((r) => r.campaignSlug === def.slug);
  return def.steps.map((step, idx) => {
    const stepSends = sends.filter((s) => s.stepId === step.id);
    const replyCount = replies.filter((r) => replyStepId(sends, r) === step.id).length;
    return {
      stepId: step.id,
      planned: enrollments.filter((e) => e.nextStep > idx || e.status === "active").length,
      sent: stepSends.filter(wasSent).length,
      delivered: stepSends.filter((s) => s.status === "delivered").length,
      opened: stepSends.filter((s) => s.opened).length,
      clicked: stepSends.filter((s) => s.clicked).length,
      replies: replyCount,
    };
  });
}

export interface DailySendPoint {
  /** YYYY-MM-DD no fuso de envio. */
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
}

/** Série diária dos últimos `days` dias (inclui dias sem envio, para o sparkline). */
export function dailySendSeries(sends: SendRecord[], days: number, now: Date, utcOffset: string): DailySendPoint[] {
  const byDay = new Map<string, DailySendPoint>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = sendDateKey(d, utcOffset);
    byDay.set(key, { date: key, sent: 0, delivered: 0, bounced: 0 });
  }
  for (const send of sends) {
    const ref = send.scheduledAt ?? send.sentAt;
    if (!ref) continue;
    const point = byDay.get(sendDateKey(new Date(ref), utcOffset));
    if (!point) continue;
    if (wasSent(send) || send.status === "scheduled") point.sent += 1;
    if (send.status === "delivered") point.delivered += 1;
    if (send.status === "bounced") point.bounced += 1;
  }
  return [...byDay.values()];
}

/**
 * Sends AGENDADOS no Resend cujo destino já não deveria receber (contato suprimido
 * ou sequência parada) — acontecem quando um cancelamento falhou ou a chave do
 * Resend não estava configurada no momento da ação. Exigem cancelamento manual.
 */
export function orphanScheduled(sends: SendRecord[], contacts: Contact[], enrollments: Enrollment[]): SendRecord[] {
  const suppressedContacts = new Set(contacts.filter((c) => c.status === "suppressed").map((c) => c.id));
  const deadEnrollments = new Set(
    enrollments.filter((e) => e.status === "stopped" || e.status === "replied").map((e) => e.id),
  );
  return sends.filter(
    (s) => s.status === "scheduled" && (suppressedContacts.has(s.contactId) || deadEnrollments.has(s.enrollmentId)),
  );
}

export interface ContactStats {
  total: number;
  byStatus: Record<ContactStatus, number>;
  byVerification: Record<VerificationStatus, number>;
  byIndustry: Map<string, number>;
}

export function contactStats(contacts: Contact[]): ContactStats {
  const byStatus: Record<ContactStatus, number> = { active: 0, excluded: 0, suppressed: 0 };
  const byVerification: Record<VerificationStatus, number> = { unverified: 0, ok: 0, risky: 0, invalid: 0 };
  const byIndustry = new Map<string, number>();
  for (const c of contacts) {
    byStatus[c.status] += 1;
    byVerification[c.verification] += 1;
    const industria = c.industria?.trim() || "(sem indústria)";
    byIndustry.set(industria, (byIndustry.get(industria) ?? 0) + 1);
  }
  return { total: contacts.length, byStatus, byVerification, byIndustry };
}

/* ─── Funil de valor e métricas de reunião (CRM piloto, PRD §29) ─────────────── */

export interface ValueFunnelStage {
  key: string;
  label: string;
  value: number;
}

/**
 * A história completa em 8 degraus, por CONTATO único (reuniões por negócio):
 * Importados → Verificados → Inscritos → Enviados → Entregues → Responderam →
 * Interessados → Reuniões (negócios que passaram por reuniao_marcada).
 */
export function valueFunnel(data: {
  contacts: Contact[];
  enrollments: Enrollment[];
  sends: SendRecord[];
  replies: Reply[];
  deals: Deal[];
}): ValueFunnelStage[] {
  const uniq = <T>(rows: T[], key: (row: T) => string) => new Set(rows.map(key)).size;
  return [
    { key: "importados", label: "Importados", value: data.contacts.length },
    { key: "verificados", label: "Verificados", value: data.contacts.filter((c) => c.verification === "ok").length },
    { key: "inscritos", label: "Inscritos", value: uniq(data.enrollments, (e) => e.contactId) },
    { key: "enviados", label: "Enviados", value: uniq(data.sends.filter(wasSent), (s) => s.contactId) },
    {
      key: "entregues",
      label: "Entregues",
      value: uniq(
        data.sends.filter((s) => s.status === "delivered"),
        (s) => s.contactId,
      ),
    },
    {
      key: "responderam",
      label: "Responderam",
      value: uniq(
        data.replies.filter((r) => r.classification !== "ooo"),
        (r) => r.contactId,
      ),
    },
    {
      key: "interessados",
      label: "Interessados",
      value: uniq(
        data.replies.filter((r) => r.classification === "interested"),
        (r) => r.contactId,
      ),
    },
    {
      key: "reunioes",
      label: "Reuniões",
      value: data.deals.filter((d) => d.stageHistory.some((h) => h.stage === "reuniao_marcada")).length,
    },
  ];
}

export interface ReplyTimeStats {
  count: number;
  meanHours: number;
  medianHours: number;
}

/** Horas entre o 1º toque da campanha e a 1ª resposta real de cada contato. */
export function replyTimeStats(sends: SendRecord[], replies: Reply[]): ReplyTimeStats | null {
  const firstRealByContact = new Map<string, Reply>();
  for (const r of replies) {
    if (r.classification === "ooo") continue;
    const prev = firstRealByContact.get(r.contactId);
    if (!prev || r.receivedAt < prev.receivedAt) firstRealByContact.set(r.contactId, r);
  }
  const deltas: number[] = [];
  for (const reply of firstRealByContact.values()) {
    const first = sends
      .filter((s) => s.contactId === reply.contactId && s.campaignSlug === reply.campaignSlug && s.sentAt)
      .map((s) => s.sentAt as string)
      .sort()[0];
    if (!first) continue;
    const hours = (Date.parse(reply.receivedAt) - Date.parse(first)) / 3_600_000;
    if (hours >= 0) deltas.push(hours);
  }
  if (deltas.length === 0) return null;
  deltas.sort((a, b) => a - b);
  const mean = deltas.reduce((sum, v) => sum + v, 0) / deltas.length;
  const mid = Math.floor(deltas.length / 2);
  const median = deltas.length % 2 === 1 ? deltas[mid]! : (deltas[mid - 1]! + deltas[mid]!) / 2;
  return { count: deltas.length, meanHours: mean, medianHours: median };
}

export interface MeetingStats {
  /** Negócios que passaram por reuniao_marcada (métrica norte). */
  geradas: number;
  realizadas: number;
  /** geradas / contatos interessados; null sem interessados. */
  taxaInteressadoReuniao: number | null;
}

export function meetingStats(deals: Deal[], replies: Reply[]): MeetingStats {
  const geradas = deals.filter((d) => d.stageHistory.some((h) => h.stage === "reuniao_marcada")).length;
  const realizadas = deals.filter((d) => d.stageHistory.some((h) => h.stage === "reuniao_realizada")).length;
  const interessados = new Set(replies.filter((r) => r.classification === "interested").map((r) => r.contactId)).size;
  return { geradas, realizadas, taxaInteressadoReuniao: interessados > 0 ? geradas / interessados : null };
}
