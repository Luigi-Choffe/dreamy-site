import type { BounceCheckpoint, SendRecord } from "./types";

/**
 * Guard-rails (PRD §21). Limiares internos deliberadamente mais rígidos que os do
 * Resend (AUP: bounce ≥ 4% / complaint ≥ 0,08% podem encerrar a conta).
 */

/** Amostra mínima antes de avaliar taxa de bounce (evita pausar no 1º azar). */
export const BOUNCE_MIN_SAMPLE = 15;
/**
 * Mínimo de bounces para pausar. Com o limite de 3%, amostras de 15 a 33 envios
 * pausavam com UM único bounce: 1/17 = 5,9% pausou a campanha de logística inteira
 * (66 inscritos) em 14/09 por um endereço isolado. Falha #13 do registro
 * docs/FALHAS-E-SALVAGUARDAS.md. Um endereço inválido não diz nada sobre a lista;
 * dois já dizem.
 */
export const BOUNCE_MIN_COUNT = 2;
/** Bounce ≥ 3% pausa a campanha e cancela agendados. */
export const BOUNCE_TRIP_RATE = 0.03;

export interface GuardRailStatus {
  sent: number;
  bounced: number;
  complained: number;
  bounceRate: number;
  /**
   * Campanha deve ser pausada (bounce ≥ 3%, com amostra mínima E pelo menos 2 bounces).
   * Com checkpoint de retomada, a régua olha só os envios DEPOIS dele; os números
   * acima continuam acumulados (é o que se reporta).
   */
  bounceTripped: boolean;
  /** Qualquer complaint dispara o breaker GLOBAL (em volume de rampa, 1 já é > 0,1%). */
  complaintTripped: boolean;
}

/** Status que contam como e-mail efetivamente processado pelo provedor. */
const ATTEMPTED_STATUSES: ReadonlySet<SendRecord["status"]> = new Set(["sent", "delivered", "bounced", "complained"]);

export function evaluateGuardRails(
  sends: SendRecord[],
  campaignSlug?: string,
  checkpoint?: BounceCheckpoint,
): GuardRailStatus {
  const scope = campaignSlug ? sends.filter((s) => s.campaignSlug === campaignSlug) : sends;
  // "pending"/"scheduled" ainda não saíram (contá-los diluiria a taxa e burlaria a
  // amostra mínima); "canceled"/"failed" nunca chegaram ao destinatário.
  const attempted = scope.filter((s) => ATTEMPTED_STATUSES.has(s.status));
  const sent = attempted.length;
  const bounced = scope.filter((s) => s.status === "bounced").length;
  const complained = scope.filter((s) => s.status === "complained").length;
  const bounceRate = sent > 0 ? bounced / sent : 0;
  // Bounce tardio de envio anterior à retomada conta como novo: erro para o lado seguro.
  const janelaSent = Math.max(0, sent - (checkpoint?.sent ?? 0));
  const janelaBounced = Math.max(0, bounced - (checkpoint?.bounced ?? 0));
  return {
    sent,
    bounced,
    complained,
    bounceRate,
    bounceTripped: bounceRuleTrips(janelaSent, janelaBounced),
    complaintTripped: complained > 0,
  };
}

function bounceRuleTrips(sent: number, bounced: number): boolean {
  return sent >= BOUNCE_MIN_SAMPLE && bounced >= BOUNCE_MIN_COUNT && bounced / sent >= BOUNCE_TRIP_RATE;
}

/** Ponto de partida da régua, gravado na retomada humana de uma campanha pausada por bounce. */
export function bounceCheckpointNow(sends: SendRecord[], campaignSlug: string, now: Date): BounceCheckpoint {
  const { sent, bounced } = evaluateGuardRails(sends, campaignSlug);
  return { at: now.toISOString(), sent, bounced };
}
