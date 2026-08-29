import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyOptOut,
  applyReply,
  buildEnrollment,
  normalizeIndustria,
  replyStepId,
  selectEnrollmentCandidates,
} from "@/lib/outbound/ops-core";
import { openStore } from "@/lib/outbound/store";
import { applySync, isPollable, mapLastEvent } from "@/lib/outbound/sync-core";
import type { Contact, Enrollment, Reply, SendRecord } from "@/lib/outbound/types";

const NOW = new Date("2026-08-27T12:00:00Z");

function makeSend(overrides: Partial<SendRecord> = {}): SendRecord {
  return {
    id: "send-1",
    enrollmentId: "enr-1",
    contactId: "ct-1",
    campaignSlug: "distribuicao-2026-09",
    stepId: "e1",
    idempotencyKey: "distribuicao-2026-09/ct-1/e1",
    resendEmailId: "re_123",
    sentAt: "2026-08-27T10:00:00.000Z",
    status: "sent",
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "ct-1",
    email: "maria@acme.com.br",
    nome: "Maria",
    industria: "Distribuição / Atacado",
    custom: {},
    importBatchId: "batch-1",
    verification: "ok",
    status: "active",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: "enr-1",
    contactId: "ct-1",
    campaignSlug: "distribuicao-2026-09",
    status: "active",
    nextStep: 1,
    createdAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapLastEvent (sync-core)", () => {
  it("mapeia cada last_event do Resend", () => {
    expect(mapLastEvent("scheduled")).toEqual({ sendStatus: "scheduled" });
    expect(mapLastEvent("sent")).toEqual({ sendStatus: "sent", eventType: "sent" });
    expect(mapLastEvent("delivered")).toEqual({ sendStatus: "delivered", eventType: "delivered" });
    expect(mapLastEvent("delivery_delayed")).toEqual({ eventType: "delivery_delayed" });
    expect(mapLastEvent("bounced")).toEqual({ sendStatus: "bounced", eventType: "bounced" });
    expect(mapLastEvent("complained")).toEqual({ sendStatus: "complained", eventType: "complained" });
    expect(mapLastEvent("opened")).toEqual({ eventType: "opened", opened: true });
    expect(mapLastEvent("clicked")).toEqual({ eventType: "clicked", clicked: true });
    expect(mapLastEvent("canceled")).toEqual({ sendStatus: "canceled", eventType: "canceled" });
    expect(mapLastEvent("failed")).toEqual({ sendStatus: "failed", eventType: "failed" });
  });

  it("null e evento desconhecido não mudam nada", () => {
    expect(mapLastEvent(null)).toEqual({});
    expect(mapLastEvent("um_evento_novo_do_resend")).toEqual({});
  });
});

describe("applySync (sync-core)", () => {
  it("sent → delivered muda status e registra evento com sourceKey de sync", () => {
    const result = applySync(makeSend(), { last_event: "delivered" }, "maria@acme.com.br", NOW);
    expect(result.send.status).toBe("delivered");
    expect(result.changed).toBe(true);
    expect(result.events).toEqual([
      {
        sendId: "send-1",
        campaignSlug: "distribuicao-2026-09",
        type: "delivered",
        sourceKey: "sync:re_123:delivered",
        occurredAt: NOW.toISOString(),
      },
    ]);
    expect(result.suppression).toBeUndefined();
    expect(result.stopEnrollment).toBeUndefined();
    expect(result.tripGlobalBreaker).toBeUndefined();
  });

  it("opened não regride delivered — só marca flag e registra evento", () => {
    const result = applySync(makeSend({ status: "delivered" }), { last_event: "opened" }, "maria@acme.com.br", NOW);
    expect(result.send.status).toBe("delivered");
    expect(result.send.opened).toBe(true);
    expect(result.events[0]?.type).toBe("opened");
  });

  it("opened/clicked sobre send 'sent' promovem a delivered (abertura implica entrega)", () => {
    const result = applySync(makeSend({ status: "sent" }), { last_event: "clicked" }, "maria@acme.com.br", NOW);
    expect(result.send.status).toBe("delivered");
    expect(result.send.clicked).toBe(true);
  });

  it("status terminal nunca regride (bounced permanece bounced)", () => {
    const result = applySync(makeSend({ status: "bounced" }), { last_event: "delivered" }, "maria@acme.com.br", NOW);
    expect(result.send.status).toBe("bounced");
  });

  it("transição só anda para a frente (delivered não volta a sent, sent não volta a scheduled)", () => {
    expect(applySync(makeSend({ status: "delivered" }), { last_event: "sent" }, "m@a.com.br", NOW).send.status).toBe(
      "delivered",
    );
    expect(applySync(makeSend({ status: "sent" }), { last_event: "scheduled" }, "m@a.com.br", NOW).send.status).toBe(
      "sent",
    );
  });

  it("bounce → supressão hard_bounce + parada por bounce, sem breaker global", () => {
    const result = applySync(makeSend(), { last_event: "bounced" }, "maria@acme.com.br", NOW);
    expect(result.send.status).toBe("bounced");
    expect(result.suppression).toEqual({ email: "maria@acme.com.br", reason: "hard_bounce" });
    expect(result.stopEnrollment).toBe("bounce");
    expect(result.tripGlobalBreaker).toBeUndefined();
  });

  it("complaint → supressão complaint + parada + breaker GLOBAL", () => {
    const result = applySync(makeSend(), { last_event: "complained" }, "maria@acme.com.br", NOW);
    expect(result.send.status).toBe("complained");
    expect(result.suppression).toEqual({ email: "maria@acme.com.br", reason: "complaint" });
    expect(result.stopEnrollment).toBe("complaint");
    expect(result.tripGlobalBreaker).toBe(true);
  });

  it("last_event repetido não gera mudança — o dedupe do evento fica com o store (sourceKey)", () => {
    const result = applySync(
      makeSend({ status: "delivered", opened: true }),
      { last_event: "opened" },
      "m@a.com.br",
      NOW,
    );
    expect(result.changed).toBe(false);
    expect(result.events).toHaveLength(1); // reemitido; store.appendEvent ignora pela sourceKey
  });
});

describe("isPollable (sync-core)", () => {
  it("scheduled e sent são consultáveis; terminais não", () => {
    expect(isPollable(makeSend({ status: "scheduled" }), NOW)).toBe(true);
    expect(isPollable(makeSend({ status: "sent" }), NOW)).toBe(true);
    expect(isPollable(makeSend({ status: "bounced" }), NOW)).toBe(false);
    expect(isPollable(makeSend({ status: "canceled" }), NOW)).toBe(false);
    expect(isPollable(makeSend({ status: "failed" }), NOW)).toBe(false);
  });

  it("delivered continua sendo consultado por até 30 dias após sentAt", () => {
    expect(isPollable(makeSend({ status: "delivered", sentAt: "2026-08-10T00:00:00.000Z" }), NOW)).toBe(true);
    expect(isPollable(makeSend({ status: "delivered", sentAt: "2026-07-01T00:00:00.000Z" }), NOW)).toBe(false);
  });

  it("sem resendEmailId não há o que consultar", () => {
    expect(isPollable(makeSend({ resendEmailId: undefined }), NOW)).toBe(false);
  });
});

describe("enroll e reply (ops-core + store em diretório temporário)", () => {
  const tmpDirs: string[] = [];

  async function tempStore() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "outbound-test-"));
    tmpDirs.push(dir);
    return openStore(dir);
  }

  afterEach(async () => {
    while (tmpDirs.length > 0) {
      await fs.rm(tmpDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("normalizeIndustria ignora caixa, acento e espaços extras", () => {
    expect(normalizeIndustria("  Distribuição /  Atacado ")).toBe("distribuicao / atacado");
    expect(normalizeIndustria("SAÚDE")).toBe(normalizeIndustria("saude"));
  });

  it("seleciona só contato ativo+verificado da indústria, sem supressão e sem sequência em andamento", async () => {
    const store = await tempStore();
    const elegivel = makeContact({ id: "ct-ok", email: "ok@empresa.com.br" });
    await store.saveContacts([
      elegivel,
      makeContact({ id: "ct-ind", email: "ind@empresa.com.br", industria: "Saúde" }),
      makeContact({ id: "ct-sup", email: "sup@empresa.com.br" }),
      makeContact({ id: "ct-ver", email: "ver@empresa.com.br", verification: "unverified" }),
      makeContact({ id: "ct-exc", email: "exc@empresa.com.br", status: "excluded" }),
      makeContact({ id: "ct-ja", email: "ja@empresa.com.br" }),
      makeContact({ id: "ct-outra", email: "outra@empresa.com.br" }),
    ]);
    await store.suppress({ email: "sup@empresa.com.br", reason: "unsubscribe" });
    await store.saveEnrollments([
      // já esteve NESTA campanha (mesmo parado): nunca reentra
      makeEnrollment({ id: "enr-ja", contactId: "ct-ja", status: "stopped", stopReason: "manual" }),
      // sequência ATIVA em outra campanha: um contato nunca está em duas ao mesmo tempo
      makeEnrollment({ id: "enr-outra", contactId: "ct-outra", campaignSlug: "saude-2026-09" }),
    ]);

    const [contacts, enrollments, suppressions] = await Promise.all([
      store.contacts(),
      store.enrollments(),
      store.suppressions(),
    ]);
    const selection = selectEnrollmentCandidates({
      contacts,
      enrollments,
      suppressed: new Set(suppressions.map((s) => s.email)),
      campaignSlug: "distribuicao-2026-09",
      industria: "distribuicao / atacado", // normalização cobre o acento do contato
    });

    expect(selection.eligible.map((c) => c.id)).toEqual(["ct-ok"]);
    expect(selection.skipped).toMatchObject({
      industriaDiferente: 1,
      suprimido: 1,
      verificacaoNaoOk: 1,
      statusNaoAtivo: 1,
      jaNaCampanha: 1,
      ativoEmOutraCampanha: 1,
    });

    const enrollment = buildEnrollment(elegivel, "distribuicao-2026-09", NOW);
    await store.saveEnrollments([...enrollments, enrollment]);
    const salvos = await store.enrollments();
    expect(salvos).toHaveLength(3);
    expect(salvos.at(-1)).toMatchObject({
      contactId: "ct-ok",
      campaignSlug: "distribuicao-2026-09",
      status: "active",
      nextStep: 0,
      createdAt: NOW.toISOString(),
    });
  });

  it("--limit derruba o excedente para alemDoLimite", () => {
    const selection = selectEnrollmentCandidates({
      contacts: [makeContact({ id: "a", email: "a@x.com.br" }), makeContact({ id: "b", email: "b@x.com.br" })],
      enrollments: [],
      suppressed: new Set(),
      campaignSlug: "c",
      industria: "Distribuição / Atacado",
      limit: 1,
    });
    expect(selection.eligible).toHaveLength(1);
    expect(selection.skipped.alemDoLimite).toBe(1);
  });

  it("reply interested para a sequência ativa (status replied, stopReason reply) e persiste no store", async () => {
    const store = await tempStore();
    const contact = makeContact();
    await store.saveContacts([contact]);
    await store.saveEnrollments([makeEnrollment()]);
    const enrollments = await store.enrollments();

    const result = applyReply(
      { contact, enrollments, classification: "interested", receivedAt: NOW.toISOString() },
      NOW,
    );
    expect(result.campaignSlug).toBe("distribuicao-2026-09");
    expect(result.stoppedEnrollmentIds).toEqual(["enr-1"]);
    expect(result.enrollments[0]).toMatchObject({ status: "replied", stopReason: "reply" });

    await store.saveEnrollments(result.enrollments);
    const replies = await store.replies();
    replies.push(result.reply);
    await store.saveReplies(replies);

    expect((await store.enrollments())[0]?.status).toBe("replied");
    const persisted = await store.replies();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ contactId: "ct-1", classification: "interested" });
  });

  it("ooo NÃO para a sequência (PRD §14: não conta como resposta real)", () => {
    const result = applyReply(
      { contact: makeContact(), enrollments: [makeEnrollment()], classification: "ooo", receivedAt: NOW.toISOString() },
      NOW,
    );
    expect(result.stoppedEnrollmentIds).toEqual([]);
    expect(result.enrollments[0]?.status).toBe("active");
    expect(result.reply.classification).toBe("ooo");
  });

  it("contato sem enrollment: erro claro (a menos que --campaign atribua)", () => {
    const contact = makeContact();
    expect(() =>
      applyReply({ contact, enrollments: [], classification: "other", receivedAt: NOW.toISOString() }, NOW),
    ).toThrow(/enrollment/);
    const result = applyReply(
      { contact, enrollments: [], classification: "other", receivedAt: NOW.toISOString(), campaignSlug: "manual-x" },
      NOW,
    );
    expect(result.reply.campaignSlug).toBe("manual-x");
  });

  it("opt-out para todos os enrollments ativos do contato com stopReason unsubscribe", () => {
    const result = applyOptOut(
      [
        makeEnrollment(),
        makeEnrollment({ id: "enr-2", campaignSlug: "saude-2026-09" }),
        makeEnrollment({ id: "enr-3", status: "finished" }),
      ],
      "ct-1",
    );
    expect([...result.stoppedEnrollmentIds].sort()).toEqual(["enr-1", "enr-2"]);
    expect(result.enrollments[0]).toMatchObject({ status: "stopped", stopReason: "unsubscribe" });
    expect(result.enrollments[2]?.status).toBe("finished");
  });
});

describe("replyStepId (atribuição de resposta ao passo — funil do report)", () => {
  const reply: Reply = {
    id: "r1",
    contactId: "ct-1",
    campaignSlug: "distribuicao-2026-09",
    classification: "interested",
    receivedAt: "2026-08-24T09:00:00.000Z",
    recordedAt: NOW.toISOString(),
  };

  it("atribui ao último passo enviado antes da resposta (agendado futuro não conta)", () => {
    const sends = [
      makeSend({ id: "s1", stepId: "e1", sentAt: "2026-08-20T10:00:00.000Z", status: "delivered" }),
      makeSend({ id: "s2", stepId: "e2", sentAt: "2026-08-23T10:00:00.000Z", status: "delivered" }),
      makeSend({
        id: "s3",
        stepId: "e3",
        sentAt: undefined,
        scheduledAt: "2026-08-30T10:00:00.000Z",
        status: "scheduled",
      }),
    ];
    expect(replyStepId(sends, reply)).toBe("e2");
  });

  it("sem envio registrado → undefined", () => {
    expect(replyStepId([], reply)).toBeUndefined();
  });
});
