import { describe, expect, it } from "vitest";
import { rewindEnrollmentForCancel, stepIndexOf } from "../../src/lib/outbound/cancel";
import { orphanScheduled } from "../../src/lib/outbound/metrics";
import { lintEmail } from "../../src/lib/outbound/render";
import type { CampaignDefinition, Contact, Enrollment, SendRecord } from "../../src/lib/outbound/types";

const DEF: CampaignDefinition = {
  slug: "dist-teste",
  industria: "distribuição",
  anchor: "sistema",
  status: "ready",
  steps: [
    { id: "e1", offsetDays: 0, subject: "a", body: "a" },
    { id: "e2", offsetDays: 3, subject: "b", body: "b" },
    { id: "e3", offsetDays: 7, subject: "c", body: "c", withLink: true },
    { id: "e4", offsetDays: 7, subject: "d", body: "d" },
  ],
};

function enrollment(over: Partial<Enrollment> = {}): Enrollment {
  return {
    id: "en1",
    contactId: "c1",
    campaignSlug: "dist-teste",
    status: "active",
    nextStep: 1,
    lastSendAt: "2026-09-01T10:00:00-03:00",
    createdAt: "2026-08-25T12:00:00Z",
    ...over,
  };
}

function send(over: Partial<SendRecord> = {}): SendRecord {
  return {
    id: "s1",
    enrollmentId: "en1",
    contactId: "c1",
    campaignSlug: "dist-teste",
    stepId: "e1",
    idempotencyKey: "dist-teste/c1/e1",
    status: "canceled",
    scheduledAt: "2026-09-01T10:00:00-03:00",
    ...over,
  };
}

describe("rewindEnrollmentForCancel", () => {
  it("e1 cancelado antes de sair: volta ao passo 0 sem lastSendAt", () => {
    const e = enrollment();
    const changed = rewindEnrollmentForCancel(e, send(), DEF, [send()]);
    expect(changed).toBe(true);
    expect(e.nextStep).toBe(0);
    expect(e.lastSendAt).toBeUndefined();
  });

  it("e2 cancelado: volta ao passo 1 com lastSendAt do e1 entregue", () => {
    const e1 = send({ id: "s1", stepId: "e1", status: "delivered", scheduledAt: "2026-08-28T10:00:00-03:00" });
    const s2 = send({ id: "s2", stepId: "e2", idempotencyKey: "dist-teste/c1/e2", scheduledAt: "2026-09-01T10:00:00-03:00" });
    const e = enrollment({ nextStep: 2, lastSendAt: s2.scheduledAt });
    expect(rewindEnrollmentForCancel(e, s2, DEF, [e1, s2])).toBe(true);
    expect(e.nextStep).toBe(1);
    expect(e.lastSendAt).toBe(e1.scheduledAt);
  });

  it("enrollment finished pelo e4 cancelado volta a active", () => {
    const s4 = send({ id: "s4", stepId: "e4", idempotencyKey: "dist-teste/c1/e4" });
    const e = enrollment({ status: "finished", nextStep: 4 });
    expect(rewindEnrollmentForCancel(e, s4, DEF, [s4])).toBe(true);
    expect(e.status).toBe("active");
    expect(e.nextStep).toBe(3);
  });

  it("enrollment parado (reply/bounce/opt-out) NÃO é rebobinado", () => {
    const e = enrollment({ status: "stopped", stopReason: "reply" });
    expect(rewindEnrollmentForCancel(e, send(), DEF, [send()])).toBe(false);
    expect(e.nextStep).toBe(1);
  });

  it("não rebobina para frente (send de passo já reexecutado)", () => {
    const e = enrollment({ nextStep: 0 });
    expect(rewindEnrollmentForCancel(e, send(), DEF, [send()])).toBe(false);
    expect(e.nextStep).toBe(0);
  });

  it("stepIndexOf resolve pelo id do passo", () => {
    expect(stepIndexOf(DEF, "e3")).toBe(2);
    expect(stepIndexOf(DEF, "e9")).toBe(-1);
  });
});

describe("orphanScheduled", () => {
  function contact(over: Partial<Contact> = {}): Contact {
    return {
      id: "c1",
      email: "x@empresa.com.br",
      nome: "X",
      custom: {},
      importBatchId: "b1",
      verification: "ok",
      status: "active",
      createdAt: "2026-08-20T12:00:00Z",
      ...over,
    };
  }

  it("aponta scheduled de contato suprimido e de sequência parada; ignora os saudáveis", () => {
    const contacts = [contact(), contact({ id: "c2", email: "y@empresa.com.br", status: "suppressed" })];
    const enrollments = [
      enrollment({ id: "en1", contactId: "c1" }),
      enrollment({ id: "en2", contactId: "c1", status: "stopped", stopReason: "reply" }),
    ];
    const sends = [
      send({ id: "s-ok", enrollmentId: "en1", contactId: "c1", status: "scheduled" }),
      send({ id: "s-suprimido", enrollmentId: "en1", contactId: "c2", status: "scheduled" }),
      send({ id: "s-parado", enrollmentId: "en2", contactId: "c1", status: "scheduled" }),
      send({ id: "s-entregue", enrollmentId: "en2", contactId: "c1", status: "delivered" }),
    ];
    const orphans = orphanScheduled(sends, contacts, enrollments).map((s) => s.id);
    expect(orphans.sort()).toEqual(["s-parado", "s-suprimido"]);
  });
});

describe("lint de placeholder malformado", () => {
  const corpo =
    "vi que a operação de vocês cresceu e queria entender como está por aí. " +
    "faz sentido conversar sobre isso na semana que vem?";

  it("chave dupla sem fechar é erro", () => {
    const issues = lintEmail("assunto ok", `{{nome} — ${corpo}`);
    expect(issues.some((i) => i.level === "error" && i.rule === "placeholder")).toBe(true);
  });

  it("chave simples é erro", () => {
    const issues = lintEmail("assunto ok", `{nome}, ${corpo}`);
    expect(issues.some((i) => i.level === "error" && i.rule === "placeholder")).toBe(true);
  });

  it("texto sem placeholder residual passa", () => {
    const issues = lintEmail("assunto ok", `Maria, ${corpo}`);
    expect(issues.filter((i) => i.rule === "placeholder")).toHaveLength(0);
  });
});
