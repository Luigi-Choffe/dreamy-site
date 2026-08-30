import { describe, expect, it } from "vitest";
import {
  buildAccountTimeline,
  ensureFollowUpTask,
  nextBusinessDay,
  pendingFollowUps,
} from "../../src/lib/outbound/crm-core";
import type { CrmNote, CrmTask, Deal, OutboundEvent, Reply, SendRecord } from "../../src/lib/outbound/types";

const OFF = "-03:00";

function task(over: Partial<CrmTask> = {}): CrmTask {
  return {
    id: "t1",
    titulo: "Responder e propor reunião",
    contactId: "c1",
    dueDate: "2026-08-31",
    status: "aberta",
    origin: "regra",
    createdBy: "sistema",
    createdAt: "2026-08-29T12:00:00Z",
    ...over,
  };
}

function reply(over: Partial<Reply> = {}): Reply {
  return {
    id: "r1",
    contactId: "c1",
    campaignSlug: "construcao-nova-receita",
    classification: "interested",
    receivedAt: "2026-08-29T14:00:00Z",
    recordedAt: "2026-08-29T14:05:00Z",
    ...over,
  };
}

describe("nextBusinessDay", () => {
  it("sexta pula para segunda; sábado e domingo também", () => {
    // 2026-08-28 é sexta (12:00 locais em SP)
    expect(nextBusinessDay(new Date("2026-08-28T15:00:00Z"), OFF)).toBe("2026-08-31");
    expect(nextBusinessDay(new Date("2026-08-29T15:00:00Z"), OFF)).toBe("2026-08-31");
    expect(nextBusinessDay(new Date("2026-08-30T15:00:00Z"), OFF)).toBe("2026-08-31");
    // segunda vai para terça
    expect(nextBusinessDay(new Date("2026-08-31T15:00:00Z"), OFF)).toBe("2026-09-01");
  });
});

describe("ensureFollowUpTask", () => {
  it("cria uma tarefa de regra no próximo dia útil", () => {
    const t = ensureFollowUpTask([], { contactId: "c1", now: new Date("2026-08-28T15:00:00Z"), utcOffset: OFF });
    expect(t?.dueDate).toBe("2026-08-31");
    expect(t?.origin).toBe("regra");
    expect(t?.status).toBe("aberta");
  });

  it("tarefa aberta bloqueia duplicata; concluída não bloqueia", () => {
    expect(ensureFollowUpTask([task()], { contactId: "c1" })).toBeNull();
    expect(ensureFollowUpTask([task({ status: "concluida" })], { contactId: "c1" })).not.toBeNull();
    expect(ensureFollowUpTask([task({ contactId: "c2" })], { contactId: "c1" })).not.toBeNull();
  });
});

describe("pendingFollowUps", () => {
  it("interessado sem tarefa aberta entra; com tarefa aberta ou classe não interessada, não", () => {
    const replies = [
      reply(),
      reply({ id: "r2", contactId: "c2", classification: "negative" }),
      reply({ id: "r3", contactId: "c3" }),
    ];
    const tasks = [task({ contactId: "c3" })];
    const pend = pendingFollowUps(replies, tasks).map((r) => r.contactId);
    expect(pend).toEqual(["c1"]);
  });
});

describe("buildAccountTimeline", () => {
  it("unifica envio, evento, resposta, nota, tarefa e estágio em ordem decrescente", () => {
    const sends: SendRecord[] = [
      {
        id: "s1",
        enrollmentId: "en1",
        contactId: "c1",
        campaignSlug: "x",
        stepId: "e1",
        idempotencyKey: "x/c1/e1",
        status: "delivered",
        sentAt: "2026-08-25T12:00:00Z",
      },
      {
        id: "s9",
        enrollmentId: "en9",
        contactId: "c9",
        campaignSlug: "x",
        stepId: "e1",
        idempotencyKey: "x/c9/e1",
        status: "delivered",
        sentAt: "2026-08-25T12:00:00Z",
      },
    ];
    const events: OutboundEvent[] = [
      {
        id: "ev1",
        sendId: "s1",
        campaignSlug: "x",
        type: "delivered",
        sourceKey: "k1",
        occurredAt: "2026-08-25T12:10:00Z",
        recordedAt: "2026-08-25T12:11:00Z",
      },
      {
        id: "ev2",
        sendId: "s1",
        campaignSlug: "x",
        type: "sent",
        sourceKey: "k2",
        occurredAt: "2026-08-25T12:01:00Z",
        recordedAt: "2026-08-25T12:02:00Z",
      },
    ];
    const notes: CrmNote[] = [
      {
        id: "n1",
        contactId: "c1",
        authorEmail: "luigi@x.com",
        body: "quer ver cases",
        origin: "manual",
        createdAt: "2026-08-29T16:00:00Z",
      },
    ];
    const deal: Deal = {
      id: "d1",
      contactId: "c1",
      stage: "respondeu",
      stageHistory: [
        { stage: "novo", at: "2026-08-24T12:00:00Z", by: "sistema" },
        { stage: "respondeu", at: "2026-08-29T14:30:00Z", by: "sistema" },
      ],
      stageChangedAt: "2026-08-29T14:30:00Z",
      stageChangedBy: "sistema",
      createdAt: "2026-08-24T12:00:00Z",
    };
    const items = buildAccountTimeline({
      contactId: "c1",
      sends,
      events,
      replies: [reply()],
      notes,
      tasks: [task()],
      deal,
    });
    // s9/ev de outro contato ficam de fora; evento "sent" é pulado
    expect(items).toHaveLength(7);
    expect(items.map((i) => i.kind)).toEqual(["nota", "estagio", "resposta", "tarefa", "evento", "envio", "estagio"]);
    expect(items[2]?.label).toContain("interessado");
    const ordered = [...items].sort((a, b) => b.at.localeCompare(a.at));
    expect(items).toEqual(ordered);
  });
});
