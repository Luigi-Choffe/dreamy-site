import { describe, expect, it } from "vitest";
import { cadeiraDoKind, cargaPorCadeira, ritmoDoTime } from "../../src/lib/outbound/team-bi";
import type { AgentActivity, Demand } from "../../src/lib/outbound/types";

const NOW = new Date("2026-09-02T12:00:00Z");

function demand(over: Partial<Demand>): Demand {
  return {
    id: over.id ?? "dm1",
    title: "Demanda de teste",
    kind: "copy",
    status: "pendente",
    priority: "normal",
    createdBy: "x@y.com",
    createdAt: "2026-09-01T10:00:00Z",
    ...over,
  };
}

function activity(over: Partial<AgentActivity>): AgentActivity {
  return { id: over.id ?? "a1", actor: "mork", kind: "crm", summary: "Registro.", at: "2026-09-02T10:00:00Z", ...over };
}

describe("cadeiraDoKind (atribuição por especialidade)", () => {
  it("mapeia cada tipo para a cadeira especialista; analise cai no MORK (MIRA vaga)", () => {
    expect(cadeiraDoKind("copy")).toBe("verbo");
    expect(cadeiraDoKind("leads")).toBe("garimpo");
    expect(cadeiraDoKind("resposta")).toBe("trato");
    expect(cadeiraDoKind("operacao")).toBe("forja");
    expect(cadeiraDoKind("outra")).toBe("forja");
    expect(cadeiraDoKind("analise")).toBe("mork");
  });
});

describe("cargaPorCadeira", () => {
  it("conta fila/andamento/concluídas na janela e guarda as entregas com média de horas", () => {
    const cargas = cargaPorCadeira(
      [
        demand({ id: "d1", kind: "leads", status: "pendente" }),
        demand({ id: "d2", kind: "leads", status: "em_andamento", claimedAt: "2026-09-01T11:00:00Z" }),
        demand({
          id: "d3",
          kind: "leads",
          status: "concluida",
          title: "Lista construção",
          createdAt: "2026-08-30T10:00:00Z",
          doneAt: "2026-08-31T10:00:00Z",
        }),
        // Fora da janela de 14 dias: não conta.
        demand({
          id: "d4",
          kind: "leads",
          status: "concluida",
          createdAt: "2026-08-01T10:00:00Z",
          doneAt: "2026-08-02T10:00:00Z",
        }),
      ],
      NOW,
    );
    const garimpo = cargas.find((c) => c.slug === "garimpo");
    expect(garimpo?.pendentes).toBe(1);
    expect(garimpo?.emAndamento).toBe(1);
    expect(garimpo?.concluidas).toBe(1);
    expect(garimpo?.entregas).toEqual([{ title: "Lista construção", doneAt: "2026-08-31T10:00:00Z" }]);
    expect(garimpo?.horasMediaConclusao).toBe(24);
    // Mais carga primeiro.
    expect(cargas[0]?.slug).toBe("garimpo");
  });

  it("cadeira sem demanda fica zerada e sem média", () => {
    const verbo = cargaPorCadeira([], NOW).find((c) => c.slug === "verbo");
    expect(verbo?.pendentes).toBe(0);
    expect(verbo?.horasMediaConclusao).toBeUndefined();
  });
});

describe("ritmoDoTime", () => {
  it("preenche os 14 dias com zeros e conta atividades no dia certo", () => {
    const ritmo = ritmoDoTime(
      [activity({ id: "a1", at: "2026-09-02T09:00:00Z" }), activity({ id: "a2", at: "2026-09-02T10:00:00Z" })],
      NOW,
    );
    expect(ritmo).toHaveLength(14);
    expect(ritmo.at(-1)).toEqual({ dateKey: "2026-09-02", total: 2 });
    expect(ritmo[0]?.total).toBe(0);
  });
});
