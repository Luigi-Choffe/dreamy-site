import { sendDateKey } from "./config";
import { evaluateGuardRails, type GuardRailStatus } from "./guardrails";
import { replyStepId } from "./ops-core";
import type {
  CampaignDefinition,
  Contact,
  ContactStatus,
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
export function dailySendSeries(
  sends: SendRecord[],
  days: number,
  now: Date,
  utcOffset: string,
): DailySendPoint[] {
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
export function orphanScheduled(
  sends: SendRecord[],
  contacts: Contact[],
  enrollments: Enrollment[],
): SendRecord[] {
  const suppressedContacts = new Set(contacts.filter((c) => c.status === "suppressed").map((c) => c.id));
  const deadEnrollments = new Set(
    enrollments.filter((e) => e.status === "stopped" || e.status === "replied").map((e) => e.id),
  );
  return sends.filter(
    (s) =>
      s.status === "scheduled" &&
      (suppressedContacts.has(s.contactId) || deadEnrollments.has(s.enrollmentId)),
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
