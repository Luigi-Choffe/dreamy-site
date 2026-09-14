/**
 * Salvaguarda da falha #13 (docs/FALHAS-E-SALVAGUARDAS.md): em 14/09 um único
 * bounce em 17 envios (5,9%) pausou a campanha de logística inteira. A pausa por
 * bounce exige amostra mínima, taxa ≥ 3% E pelo menos 2 bounces.
 */
import { describe, expect, it } from "vitest";
import { BOUNCE_MIN_COUNT, BOUNCE_MIN_SAMPLE, evaluateGuardRails } from "@/lib/outbound/guardrails";
import type { SendRecord } from "@/lib/outbound/types";

function sends(total: number, bounced: number, campaignSlug = "camp"): SendRecord[] {
  return Array.from(
    { length: total },
    (_, i) =>
      ({
        id: `s${i}`,
        campaignSlug,
        status: i < bounced ? "bounced" : "delivered",
      }) as SendRecord,
  );
}

describe("#13 guard-rail de bounce por campanha", () => {
  it("um bounce isolado nunca pausa, mesmo com taxa acima de 3% (o caso real: 1 em 17)", () => {
    const r = evaluateGuardRails(sends(17, 1), "camp");
    expect(r.bounceRate).toBeGreaterThan(0.03);
    expect(r.bounceTripped).toBe(false);
  });

  it("dois bounces com amostra mínima e taxa ≥ 3% pausam", () => {
    expect(evaluateGuardRails(sends(17, 2), "camp").bounceTripped).toBe(true);
    expect(evaluateGuardRails(sends(66, 2), "camp").bounceTripped).toBe(true);
  });

  it("abaixo da amostra mínima ou abaixo de 3% não pausa", () => {
    expect(evaluateGuardRails(sends(BOUNCE_MIN_SAMPLE - 1, 3), "camp").bounceTripped).toBe(false);
    expect(evaluateGuardRails(sends(100, 2), "camp").bounceTripped).toBe(false);
  });

  it("a avaliação é por campanha: bounces de outra campanha não contam", () => {
    const mistura = [...sends(20, 0, "camp"), ...sends(20, 5, "outra")];
    expect(evaluateGuardRails(mistura, "camp").bounceTripped).toBe(false);
    expect(evaluateGuardRails(mistura, "outra").bounceTripped).toBe(true);
    expect(BOUNCE_MIN_COUNT).toBe(2);
  });
});
