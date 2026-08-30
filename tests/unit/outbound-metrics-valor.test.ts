import { describe, expect, it } from "vitest";
import { meetingStats, replyTimeStats, valueFunnel } from "../../src/lib/outbound/metrics";
import type { Contact, Deal, Enrollment, Reply, SendRecord } from "../../src/lib/outbound/types";

function contact(id: string, verification: Contact["verification"] = "ok"): Contact {
  return {
    id,
    email: `${id}@empresa.com.br`,
    nome: id,
    custom: {},
    importBatchId: "b1",
    verification,
    status: "active",
    createdAt: "2026-08-20T12:00:00Z",
  };
}

function send(contactId: string, status: SendRecord["status"], sentAt?: string): SendRecord {
  return {
    id: `s-${contactId}-${status}-${sentAt ?? ""}`,
    enrollmentId: `en-${contactId}`,
    contactId,
    campaignSlug: "c",
    stepId: "e1",
    idempotencyKey: `c/${contactId}/e1-${status}`,
    status,
    sentAt,
  };
}

function reply(contactId: string, classification: Reply["classification"], receivedAt: string): Reply {
  return {
    id: `r-${contactId}-${receivedAt}`,
    contactId,
    campaignSlug: "c",
    classification,
    receivedAt,
    recordedAt: receivedAt,
  };
}

function deal(contactId: string, stages: Deal["stageHistory"]): Deal {
  return {
    id: `d-${contactId}`,
    contactId,
    stage: stages.at(-1)?.stage ?? "novo",
    stageHistory: stages,
    stageChangedAt: stages.at(-1)?.at ?? "2026-08-20T12:00:00Z",
    stageChangedBy: "sistema",
    createdAt: "2026-08-20T12:00:00Z",
  };
}

const H = (n: number) => `2026-08-2${Math.floor(n / 24) + 5}T${String(n % 24).padStart(2, "0")}:00:00Z`;

describe("valueFunnel", () => {
  it("conta contatos únicos degrau a degrau e reuniões pelo histórico do negócio", () => {
    const enrollment = (contactId: string): Enrollment => ({
      id: `en-${contactId}`,
      contactId,
      campaignSlug: "c",
      status: "active",
      nextStep: 1,
      createdAt: "2026-08-25T12:00:00Z",
    });
    const stages = valueFunnel({
      contacts: [contact("c1"), contact("c2"), contact("c3", "risky")],
      enrollments: [enrollment("c1"), enrollment("c2")],
      sends: [send("c1", "delivered", H(0)), send("c1", "delivered", H(1)), send("c2", "sent", H(0))],
      replies: [reply("c1", "interested", H(5)), reply("c1", "interested", H(9)), reply("c2", "ooo", H(3))],
      deals: [
        deal("c1", [
          { stage: "novo", at: H(0), by: "sistema" },
          { stage: "reuniao_marcada", at: H(6), by: "x" },
          { stage: "reuniao_realizada", at: H(30), by: "x" },
        ]),
      ],
    });
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s.value]));
    expect(byKey).toEqual({
      importados: 3,
      verificados: 2,
      inscritos: 2,
      enviados: 2,
      entregues: 1,
      responderam: 1,
      interessados: 1,
      reunioes: 1,
    });
    expect(stages.map((s) => s.key)[0]).toBe("importados");
    expect(stages.at(-1)?.key).toBe("reunioes");
  });
});

describe("replyTimeStats", () => {
  it("mede da 1ª mensagem enviada até a 1ª resposta real por contato", () => {
    const sends = [send("c1", "delivered", H(0)), send("c2", "delivered", H(0))];
    const replies = [
      reply("c1", "interested", H(10)), // 10 h
      reply("c1", "other", H(20)), // ignorada (não é a primeira)
      reply("c2", "ooo", H(1)), // ooo não conta
      reply("c2", "negative", H(30)), // 30 h
    ];
    const stats = replyTimeStats(sends, replies);
    expect(stats?.count).toBe(2);
    expect(stats?.meanHours).toBe(20);
    expect(stats?.medianHours).toBe(20);
  });

  it("sem respostas reais devolve null", () => {
    expect(replyTimeStats([send("c1", "delivered", H(0))], [reply("c1", "ooo", H(2))])).toBeNull();
  });
});

describe("meetingStats", () => {
  it("geradas/realizadas pelo histórico e taxa sobre interessados", () => {
    const deals = [
      deal("c1", [
        { stage: "reuniao_marcada", at: H(1), by: "x" },
        { stage: "reuniao_realizada", at: H(2), by: "x" },
      ]),
      deal("c2", [{ stage: "reuniao_marcada", at: H(1), by: "x" }]),
      deal("c3", [{ stage: "respondeu", at: H(1), by: "sistema" }]),
    ];
    const replies = [
      reply("c1", "interested", H(0)),
      reply("c2", "interested", H(0)),
      reply("c3", "interested", H(0)),
      reply("c4", "interested", H(0)),
    ];
    const stats = meetingStats(deals, replies);
    expect(stats.geradas).toBe(2);
    expect(stats.realizadas).toBe(1);
    expect(stats.taxaInteressadoReuniao).toBe(0.5);
  });

  it("sem interessados a taxa é null", () => {
    expect(meetingStats([], []).taxaInteressadoReuniao).toBeNull();
  });
});
