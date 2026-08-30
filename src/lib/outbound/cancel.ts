import { logger } from "../observability/logger";
import type { ResendClient } from "./resend";
import type { OutboundStore } from "./store";
import type { CampaignDefinition, Enrollment, SendRecord } from "./types";

/**
 * Cancelamento de sends agendados + rebobinagem do enrollment.
 *
 * Quando um send "scheduled" é cancelado (breaker, pausa de campanha, opt-out),
 * o enrollment que já tinha avançado `nextStep`/`lastSendAt` no agendamento
 * precisa voltar — senão a sequência pula um passo que o contato NUNCA recebeu
 * (ex.: e2 "sobre o que te escrevi" sem e1). A rebobinagem só se aplica a
 * enrollments que continuam vivos (active/finished); os parados (reply, bounce,
 * opt-out) ficam parados — cancelar ali é só impedir o envio.
 */

export function stepIndexOf(def: CampaignDefinition, stepId: string): number {
  return def.steps.findIndex((s) => s.id === stepId);
}

/**
 * Rebobina o enrollment para reexecutar o passo do send cancelado (mutação in-place).
 * `otherSends` = demais sends do MESMO enrollment (para restaurar o lastSendAt anterior).
 * Retorna true se algo mudou.
 */
export function rewindEnrollmentForCancel(
  enrollment: Enrollment,
  canceledSend: SendRecord,
  def: CampaignDefinition | undefined,
  otherSends: SendRecord[],
): boolean {
  if (enrollment.status !== "active" && enrollment.status !== "finished") return false;
  const idx = def ? stepIndexOf(def, canceledSend.stepId) : -1;
  if (idx < 0 || idx >= enrollment.nextStep) return false;

  enrollment.nextStep = idx;
  const anteriores = otherSends
    .filter(
      (s) =>
        s.enrollmentId === enrollment.id &&
        s.id !== canceledSend.id &&
        s.status !== "canceled" &&
        s.status !== "failed" &&
        s.scheduledAt !== undefined,
    )
    .sort((a, b) => (a.scheduledAt as string).localeCompare(b.scheduledAt as string));
  const anterior = anteriores.at(-1);
  if (anterior) enrollment.lastSendAt = anterior.scheduledAt;
  else delete enrollment.lastSendAt;
  if (enrollment.status === "finished") enrollment.status = "active";
  return true;
}

export interface CancelScope {
  sends: SendRecord[];
  enrollments: Enrollment[];
  defsBySlug: Map<string, CampaignDefinition>;
  match: (send: SendRecord) => boolean;
  motivo: string;
  now: Date;
  /** false = não rebobinar (ex.: opt-out — a sequência para de qualquer jeito). */
  rewind?: boolean;
}

export interface CancelResult {
  canceled: number;
  failures: number;
  rewound: number;
}

/**
 * Cancela no Resend e localmente os sends "scheduled" que casam com `match`,
 * registrando evento e rebobinando enrollments vivos. Erro por item não interrompe
 * o resto. Quem persiste sends/enrollments é o chamador.
 *
 * `client: null` = cancelamento SÓ local, exclusivo para stores de sandbox/demo
 * (sem e-mail real por trás). Em store real, cancelar localmente sem cancelar no
 * Resend seria mentira — passe sempre um client.
 */
export async function cancelScheduledSends(
  client: ResendClient | null,
  store: OutboundStore,
  scope: CancelScope,
): Promise<CancelResult> {
  const { sends, enrollments, defsBySlug, match, motivo, now, rewind = true } = scope;
  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));
  let canceled = 0;
  let failures = 0;
  let rewound = 0;

  for (const send of sends) {
    if (send.status !== "scheduled" || !match(send)) continue;
    try {
      if (client && send.resendEmailId) await client.cancelEmail(send.resendEmailId);
      send.status = "canceled";
      send.error = `cancelado: ${motivo}`;
      canceled++;
      if (send.resendEmailId) {
        await store.appendEvent({
          sendId: send.id,
          campaignSlug: send.campaignSlug,
          type: "canceled",
          sourceKey: `cancel:${send.resendEmailId}`,
          occurredAt: now.toISOString(),
        });
      }
      if (rewind) {
        const enrollment = enrollmentById.get(send.enrollmentId);
        if (enrollment && rewindEnrollmentForCancel(enrollment, send, defsBySlug.get(send.campaignSlug), sends)) {
          rewound++;
        }
      }
    } catch (err) {
      failures++;
      logger.error("outbound.cancel_falhou", {
        sendId: send.id,
        campaignSlug: send.campaignSlug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { canceled, failures, rewound };
}
