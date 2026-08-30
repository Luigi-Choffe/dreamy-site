import { describe, expect, it } from "vitest";
import { applyDemandTransition, buildDemand, canTransition } from "../../src/lib/outbound/demands-core";
import type { Demand } from "../../src/lib/outbound/types";

function demand(over: Partial<Demand> = {}): Demand {
  return {
    id: "dm1",
    title: "Nova lista de obras para terceiros",
    kind: "leads",
    status: "pendente",
    priority: "normal",
    createdBy: "luigi@x.com",
    createdAt: "2026-08-30T12:00:00Z",
    ...over,
  };
}

describe("canTransition", () => {
  it("aceita o fluxo pendente > em_andamento > concluida e recusas", () => {
    expect(canTransition("pendente", "em_andamento")).toBe(true);
    expect(canTransition("pendente", "recusada")).toBe(true);
    expect(canTransition("pendente", "cancelada")).toBe(true);
    expect(canTransition("em_andamento", "concluida")).toBe(true);
    expect(canTransition("em_andamento", "recusada")).toBe(true);
  });

  it("bloqueia atalhos e estados finais", () => {
    expect(canTransition("pendente", "concluida")).toBe(false);
    expect(canTransition("em_andamento", "cancelada")).toBe(false);
    expect(canTransition("concluida", "pendente")).toBe(false);
    expect(canTransition("recusada", "em_andamento")).toBe(false);
    expect(canTransition("cancelada", "em_andamento")).toBe(false);
  });
});

describe("applyDemandTransition", () => {
  it("claim registra quem assumiu; done exige resolução e fecha", () => {
    const d = demand();
    applyDemandTransition(d, { to: "em_andamento", by: "mork" });
    expect(d.status).toBe("em_andamento");
    expect(d.claimedBy).toBe("mork");
    expect(d.claimedAt).toBeDefined();

    expect(() => applyDemandTransition(d, { to: "concluida", by: "mork" })).toThrow(/resolução/);
    applyDemandTransition(d, { to: "concluida", by: "mork", resolution: "lista importada e segmentada" });
    expect(d.status).toBe("concluida");
    expect(d.resolution).toBe("lista importada e segmentada");
    expect(d.doneAt).toBeDefined();
  });

  it("recusa exige motivo; cancelamento só de pendente", () => {
    const d = demand();
    expect(() => applyDemandTransition(d, { to: "recusada", by: "mork" })).toThrow(/resolução/);
    applyDemandTransition(d, { to: "recusada", by: "mork", resolution: "fora do escopo do outbound" });
    expect(d.status).toBe("recusada");

    const e = demand({ id: "dm2" });
    applyDemandTransition(e, { to: "cancelada", by: "luigi@x.com" });
    expect(e.status).toBe("cancelada");
    expect(() => applyDemandTransition(e, { to: "em_andamento", by: "mork" })).toThrow(/inválida/);
  });
});

describe("buildDemand", () => {
  it("cria pendente com defaults e valida entrada", () => {
    const d = buildDemand({ title: "  Revisar copy E3  ", kind: "copy", createdBy: "socio@x.com" });
    expect(d.status).toBe("pendente");
    expect(d.title).toBe("Revisar copy E3");
    expect(d.priority).toBe("normal");
    expect(() => buildDemand({ title: "   ", kind: "copy", createdBy: "x" })).toThrow(/título/);
  });
});
