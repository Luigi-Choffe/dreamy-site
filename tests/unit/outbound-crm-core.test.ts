import { describe, expect, it } from "vitest";
import { applyStageMove, buildManualDeal, reconcileDeals } from "../../src/lib/outbound/crm-core";
import type { Contact, Deal, Enrollment, Reply, SendRecord } from "../../src/lib/outbound/types";

function contact(id: string, over: Partial<Contact> = {}): Contact {
  return {
    id,
    email: `${id}@empresa.com.br`,
    nome: `Nome ${id}`,
    empresa: `Empresa ${id}`,
    custom: {},
    importBatchId: "b1",
    verification: "ok",
    status: "active",
    createdAt: "2026-08-20T12:00:00Z",
    ...over,
  };
}

function enrollment(contactId: string, over: Partial<Enrollment> = {}): Enrollment {
  return {
    id: `en-${contactId}`,
    contactId,
    campaignSlug: "construcao-nova-receita",
    status: "active",
    nextStep: 0,
    createdAt: "2026-08-25T12:00:00Z",
    ...over,
  };
}

function send(contactId: string, status: SendRecord["status"]): SendRecord {
  return {
    id: `s-${contactId}-${status}`,
    enrollmentId: `en-${contactId}`,
    contactId,
    campaignSlug: "construcao-nova-receita",
    stepId: "e1",
    idempotencyKey: `construcao-nova-receita/${contactId}/e1`,
    status,
  };
}

function reply(contactId: string, classification: Reply["classification"]): Reply {
  return {
    id: `r-${contactId}`,
    contactId,
    campaignSlug: "construcao-nova-receita",
    classification,
    receivedAt: "2026-08-29T12:00:00Z",
    recordedAt: "2026-08-29T12:05:00Z",
  };
}

const NOW = new Date("2026-08-30T12:00:00Z");

describe("reconcileDeals", () => {
  it("cria negócios nos estágios certos e é idempotente", () => {
    const input = {
      contacts: [contact("c1"), contact("c2"), contact("c3")],
      enrollments: [enrollment("c1"), enrollment("c2"), enrollment("c3", { status: "replied" })],
      sends: [send("c2", "delivered"), send("c3", "delivered")],
      replies: [reply("c3", "interested")],
      deals: [] as Deal[],
    };
    const before = JSON.stringify(input);
    const first = reconcileDeals(input, NOW);
    expect(first.created).toBe(3);
    const byContact = new Map(first.deals.map((d) => [d.contactId, d]));
    expect(byContact.get("c1")?.stage).toBe("novo");
    expect(byContact.get("c2")?.stage).toBe("contatado");
    expect(byContact.get("c3")?.stage).toBe("respondeu");
    expect(byContact.get("c3")?.campaignSlug).toBe("construcao-nova-receita");
    expect(byContact.get("c3")?.empresa).toBe("Empresa c3");
    // entrada intacta (motor nunca é tocado)
    expect(JSON.stringify(input)).toBe(before);
    // segunda rodada: nada muda
    const second = reconcileDeals({ ...input, deals: first.deals }, NOW);
    expect(second.created).toBe(0);
    expect(second.advanced).toBe(0);
    expect(second.deals).toHaveLength(3);
  });

  it("avança estágio automático, mas nunca rebaixa estágio manual", () => {
    const base = reconcileDeals(
      {
        contacts: [contact("c1")],
        enrollments: [enrollment("c1")],
        sends: [],
        replies: [],
        deals: [],
      },
      NOW,
    ).deals;
    expect(base[0]?.stage).toBe("novo");

    // contato respondeu depois: avança para respondeu
    const advanced = reconcileDeals(
      {
        contacts: [contact("c1")],
        enrollments: [enrollment("c1", { status: "replied" })],
        sends: [send("c1", "delivered")],
        replies: [reply("c1", "interested")],
        deals: base,
      },
      NOW,
    );
    expect(advanced.advanced).toBe(1);
    expect(advanced.deals[0]?.stage).toBe("respondeu");

    // operador moveu para proposta; novo reconcile NÃO rebaixa
    const manual = advanced.deals.map((d) => ({ ...d, stageHistory: [...d.stageHistory] }));
    applyStageMove(manual[0]!, { to: "reuniao_marcada", by: "luigi@x.com", reuniaoEm: "2026-09-03T14:00:00-03:00" });
    applyStageMove(manual[0]!, { to: "proposta", by: "luigi@x.com" });
    const after = reconcileDeals(
      {
        contacts: [contact("c1")],
        enrollments: [enrollment("c1", { status: "replied" })],
        sends: [send("c1", "delivered")],
        replies: [reply("c1", "interested")],
        deals: manual,
      },
      NOW,
    );
    expect(after.advanced).toBe(0);
    expect(after.deals[0]?.stage).toBe("proposta");
    expect(after.deals[0]?.autoStage).toBe("respondeu");
  });

  it("ooo não conta como resposta; enrollment morto sem resposta não vira negócio", () => {
    const result = reconcileDeals(
      {
        contacts: [contact("c1"), contact("c2")],
        enrollments: [enrollment("c1"), enrollment("c2", { status: "stopped", stopReason: "bounce" })],
        sends: [send("c1", "delivered"), send("c2", "bounced")],
        replies: [reply("c1", "ooo")],
        deals: [],
      },
      NOW,
    );
    expect(result.created).toBe(1);
    expect(result.deals[0]?.contactId).toBe("c1");
    expect(result.deals[0]?.stage).toBe("contatado"); // ooo não vira "respondeu"
  });
});

describe("applyStageMove", () => {
  function deal(over: Partial<Deal> = {}): Deal {
    return {
      id: "d1",
      contactId: "c1",
      stage: "respondeu",
      autoStage: "respondeu",
      stageHistory: [{ stage: "novo", at: "2026-08-25T12:00:00Z", by: "sistema" }],
      stageChangedAt: "2026-08-29T12:00:00Z",
      stageChangedBy: "sistema",
      createdAt: "2026-08-25T12:00:00Z",
      ...over,
    };
  }

  it("perdido exige motivo; reuniao_marcada exige data; piso automático bloqueia volta", () => {
    expect(() => applyStageMove(deal(), { to: "perdido", by: "x@y.com" })).toThrow(/motivo/);
    expect(() => applyStageMove(deal(), { to: "reuniao_marcada", by: "x@y.com" })).toThrow(/data\/hora/);
    expect(() => applyStageMove(deal(), { to: "contatado", by: "x@y.com" })).toThrow(/piso|não pode voltar/);
  });

  it("movimento válido registra histórico, autor e dados do estágio", () => {
    const d = deal();
    expect(
      applyStageMove(d, { to: "reuniao_marcada", by: "luigi@x.com", reuniaoEm: "2026-09-03T14:00:00-03:00" }),
    ).toBe(true);
    expect(d.stage).toBe("reuniao_marcada");
    expect(d.reuniaoEm).toBe("2026-09-03T14:00:00-03:00");
    expect(d.stageChangedBy).toBe("luigi@x.com");
    expect(d.stageHistory.at(-1)?.stage).toBe("reuniao_marcada");

    expect(applyStageMove(d, { to: "perdido", by: "luigi@x.com", motivo: "sem orçamento" })).toBe(true);
    expect(d.lostReason).toBe("sem orçamento");

    // mesmo estágio: no-op (mas valor atualiza)
    expect(applyStageMove(d, { to: "perdido", by: "luigi@x.com", motivo: "x", valorEstimado: 50_000 })).toBe(false);
    expect(d.valorEstimado).toBe(50_000);
  });

  it("buildManualDeal cria em novo com autor humano", () => {
    const d = buildManualDeal({ contact: contact("c9"), by: "luigi@x.com" });
    expect(d.stage).toBe("novo");
    expect(d.autoStage).toBeUndefined();
    expect(d.stageHistory[0]?.by).toBe("luigi@x.com");
  });
});
