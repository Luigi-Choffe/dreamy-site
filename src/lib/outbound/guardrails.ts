import type { SendRecord } from "./types";

/**
 * Guard-rails (PRD §21). Limiares internos deliberadamente mais rígidos que os do
 * Resend (AUP: bounce ≥ 4% / complaint ≥ 0,08% podem encerrar a conta).
 */

/** Amostra mínima antes de avaliar taxa de bounce (evita pausar no 1º azar). */
export const BOUNCE_MIN_SAMPLE = 15;
/** Bounce ≥ 3% pausa a campanha e cancela agendados. */
export const BOUNCE_TRIP_RATE = 0.03;

export interface GuardRailStatus {
  sent: number;
  bounced: number;
  complained: number;
  bounceRate: number;
  /** Campanha deve ser pausada (bounce ≥ 3% com amostra mínima). */
  bounceTripped: boolean;
  /** Qualquer complaint dispara o breaker GLOBAL (em volume de rampa, 1 já é > 0,1%). */
  complaintTripped: boolean;
}

/** Status que contam como e-mail efetivamente processado pelo provedor. */
const ATTEMPTED_STATUSES: ReadonlySet<SendRecord["status"]> = new Set([
  "sent",
  "delivered",
  "bounced",
  "complained",
]);

export function evaluateGuardRails(sends: SendRecord[], campaignSlug?: string): GuardRailStatus {
  const scope = campaignSlug ? sends.filter((s) => s.campaignSlug === campaignSlug) : sends;
  // "pending"/"scheduled" ainda não saíram (contá-los diluiria a taxa e burlaria a
  // amostra mínima); "canceled"/"failed" nunca chegaram ao destinatário.
  const attempted = scope.filter((s) => ATTEMPTED_STATUSES.has(s.status));
  const sent = attempted.length;
  const bounced = scope.filter((s) => s.status === "bounced").length;
  const complained = scope.filter((s) => s.status === "complained").length;
  const bounceRate = sent > 0 ? bounced / sent : 0;
  return {
    sent,
    bounced,
    complained,
    bounceRate,
    bounceTripped: sent >= BOUNCE_MIN_SAMPLE && bounceRate >= BOUNCE_TRIP_RATE,
    complaintTripped: complained > 0,
  };
}
