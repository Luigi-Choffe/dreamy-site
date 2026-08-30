import { describe, expect, it } from "vitest";
import { seatStatus, TEAM, teamGraph } from "../../src/lib/outbound/team";
import type { AgentActivity, Demand } from "../../src/lib/outbound/types";

const NOW = new Date("2026-08-31T12:00:00Z");

function seat(slug: string) {
  const found = TEAM.find((s) => s.slug === slug);
  if (!found) throw new Error(`cadeira ${slug} não existe`);
  return found;
}

function demand(over: Partial<Demand>): Demand {
  return {
    id: "dm1",
    title: "Demanda de teste",
    kind: "copy",
    status: "pendente",
    priority: "normal",
    createdBy: "x@y.com",
    createdAt: "2026-08-30T12:00:00Z",
    ...over,
  };
}

function activity(over: Partial<AgentActivity>): AgentActivity {
  return {
    id: "a1",
    actor: "mork",
    kind: "crm",
    summary: "Pipeline sincronizado: 16 negócios.",
    at: "2026-08-31T10:00:00Z",
    ...over,
  };
}

describe("registro do time", () => {
  it("tem o MORK no topo e 5 cadeiras abaixo, com a MIRA vaga", () => {
    expect(TEAM).toHaveLength(6);
    expect(TEAM[0]?.slug).toBe("mork");
    expect(TEAM.filter((s) => !s.hired).map((s) => s.slug)).toEqual(["mira"]);
  });
});

describe("seatStatus", () => {
  it("MORK mostra a última atividade recente dele; sem atividade, o posto padrão", () => {
    const recent = seatStatus(seat("mork"), { demands: [], activities: [activity({})], now: NOW });
    expect(recent.label).toContain("Pipeline sincronizado");
    expect(recent.live).toBe(true);

    const stale = seatStatus(seat("mork"), {
      demands: [],
      activities: [activity({ at: "2026-08-20T10:00:00Z" })],
      now: NOW,
    });
    expect(stale.label).toContain("09:05");
  });

  it("agente com demanda em andamento do seu tipo aparece trabalhando nela", () => {
    const s = seatStatus(seat("verbo"), {
      demands: [
        demand({ status: "em_andamento", kind: "copy", title: "Campanha obras", claimedAt: "2026-08-31T09:00:00Z" }),
      ],
      activities: [],
      now: NOW,
    });
    expect(s.label).toBe("na demanda: Campanha obras");
    expect(s.live).toBe(true);
  });

  it("sem trabalho ativo: mostra a entrega recente; sem entrega, disponível", () => {
    const delivered = seatStatus(seat("trato"), {
      demands: [
        demand({ status: "concluida", kind: "resposta", title: "Triagem da semana", doneAt: "2026-08-29T12:00:00Z" }),
      ],
      activities: [],
      now: NOW,
    });
    expect(delivered.label).toBe("entregou: Triagem da semana");
    expect(delivered.live).toBe(false);

    const idle = seatStatus(seat("garimpo"), { demands: [], activities: [], now: NOW });
    expect(idle.label).toContain("disponível");
  });

  it("demanda de outro tipo não ocupa a cadeira errada", () => {
    const s = seatStatus(seat("verbo"), {
      demands: [demand({ status: "em_andamento", kind: "leads", title: "Lista nova" })],
      activities: [],
      now: NOW,
    });
    expect(s.label).not.toContain("Lista nova");
  });

  it("cadeira vaga (MIRA) fala em cadeira vazia e nunca acende", () => {
    const s = seatStatus(seat("mira"), { demands: [], activities: [], now: NOW });
    expect(s.label).toContain("cadeira vazia");
    expect(s.live).toBe(false);
  });
});
describe("teamGraph (rede do Aquário)", () => {
  it("tem 6 nós na constelação e 8 sinapses (4 comando, 1 vaga, 3 colaboração)", () => {
    const graph = teamGraph({ demands: [], activities: [], now: NOW });
    expect(graph.nodes).toHaveLength(6);
    expect(graph.nodes[0]?.slug).toBe("mork");
    const kinds = graph.links.map((l) => l.kind);
    expect(kinds.filter((k) => k === "comando")).toHaveLength(4);
    expect(kinds.filter((k) => k === "vaga")).toHaveLength(1);
    expect(kinds.filter((k) => k === "colaboracao")).toHaveLength(3);
    expect(graph.links.every((l) => !l.active)).toBe(true);
  });

  it("demanda em andamento acende o nó e a sinapse de comando do agente certo", () => {
    const graph = teamGraph({
      demands: [demand({ status: "em_andamento", kind: "copy", claimedAt: "2026-08-31T09:00:00Z" })],
      activities: [],
      now: NOW,
    });
    expect(graph.nodes.find((n) => n.slug === "verbo")?.live).toBe(true);
    expect(graph.links.find((l) => l.to === "verbo" && l.kind === "comando")?.active).toBe(true);
    expect(graph.links.find((l) => l.to === "garimpo" && l.kind === "comando")?.active).toBe(false);
  });

  it("dois agentes tocando a MESMA campanha acendem a sinapse de colaboração", () => {
    const shared = [
      demand({
        id: "dm-copy",
        status: "em_andamento",
        kind: "copy",
        campaignSlug: "obras",
        claimedAt: "2026-08-31T09:00:00Z",
      }),
      demand({
        id: "dm-leads",
        status: "concluida",
        kind: "leads",
        campaignSlug: "obras",
        doneAt: "2026-08-30T09:00:00Z",
      }),
    ];
    const on = teamGraph({ demands: shared, activities: [], now: NOW });
    expect(on.links.find((l) => l.kind === "colaboracao" && l.from === "verbo" && l.to === "garimpo")?.active).toBe(
      true,
    );

    const separate = teamGraph({
      demands: [
        demand({
          id: "dm-copy",
          status: "em_andamento",
          kind: "copy",
          campaignSlug: "obras",
          claimedAt: "2026-08-31T09:00:00Z",
        }),
        demand({
          id: "dm-leads",
          status: "concluida",
          kind: "leads",
          campaignSlug: "OUTRA",
          doneAt: "2026-08-30T09:00:00Z",
        }),
      ],
      activities: [],
      now: NOW,
    });
    expect(
      separate.links.find((l) => l.kind === "colaboracao" && l.from === "verbo" && l.to === "garimpo")?.active,
    ).toBe(false);
  });

  it("a cadeira vaga entra como sinapse tracejada e nunca acende", () => {
    const graph = teamGraph({ demands: [], activities: [], now: NOW });
    const vaga = graph.links.find((l) => l.kind === "vaga");
    expect(vaga?.to).toBe("mira");
    expect(vaga?.active).toBe(false);
    expect(graph.nodes.find((n) => n.slug === "mira")?.hired).toBe(false);
  });
});
