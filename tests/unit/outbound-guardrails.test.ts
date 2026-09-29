/**
 * Salvaguarda da falha #13 (docs/FALHAS-E-SALVAGUARDAS.md): em 14/09 um único
 * bounce em 17 envios (5,9%) pausou a campanha de logística inteira. A pausa por
 * bounce exige amostra mínima, taxa ≥ 3% E pelo menos 2 bounces.
 */
import { describe, expect, it } from "vitest";
import {
  BOUNCE_MIN_COUNT,
  BOUNCE_MIN_SAMPLE,
  bounceCheckpointNow,
  evaluateGuardRails,
} from "@/lib/outbound/guardrails";
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

/**
 * Salvaguarda da falha #17: a logística pausou em 17/09 com 3 bounces em 82 e o
 * `resume` não destravava — o motor recalculava a taxa acumulada e bloqueava os
 * envios que a diluiriam. A retomada humana grava um checkpoint e a MESMA régua
 * passa a valer só para os envios feitos depois dele.
 */
describe("#17 retomada após pausa por bounce", () => {
  const NOW = new Date("2026-09-29T15:00:00Z");

  it("o caso real (3 em 82) destrava com o checkpoint e os números seguem acumulados", () => {
    const antes = sends(82, 3);
    expect(evaluateGuardRails(antes, "camp").bounceTripped).toBe(true);
    const cp = bounceCheckpointNow(antes, "camp", NOW);
    expect(cp).toEqual({ at: NOW.toISOString(), sent: 82, bounced: 3 });
    const r = evaluateGuardRails(antes, "camp", cp);
    expect(r.bounceTripped).toBe(false);
    expect(r.bounced).toBe(3);
    expect(r.sent).toBe(82);
  });

  it("depois da retomada, envios limpos mantêm a campanha rodando", () => {
    const cp = bounceCheckpointNow(sends(82, 3), "camp", NOW);
    expect(evaluateGuardRails(sends(82 + 40, 3), "camp", cp).bounceTripped).toBe(false);
  });

  it("depois da retomada, a régua inteira volta a valer: 2 bounces novos em 20 pausam de novo", () => {
    const cp = bounceCheckpointNow(sends(82, 3), "camp", NOW);
    expect(evaluateGuardRails(sends(82 + 20, 3 + 2), "camp", cp).bounceTripped).toBe(true);
  });

  it("um bounce novo isolado depois da retomada não pausa (mesma régua da #13)", () => {
    const cp = bounceCheckpointNow(sends(82, 3), "camp", NOW);
    expect(evaluateGuardRails(sends(82 + 17, 3 + 1), "camp", cp).bounceTripped).toBe(false);
  });
});
