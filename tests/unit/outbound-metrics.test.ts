import { describe, expect, it } from "vitest";
import { campaignMetrics, contactStats, dailySendSeries, stepFunnel } from "../../src/lib/outbound/metrics";
import type { CampaignDefinition, Contact, Enrollment, Reply, SendRecord } from "../../src/lib/outbound/types";

/** Agregações do console (`/interno/outbound`) — fixtures pequenas, sem fs. */

const DEF: CampaignDefinition = {
  slug: "camp-a",
  industria: "exemplo",
  anchor: "sistema",
  status: "ready",
  steps: [
    { id: "e1", offsetDays: 0, subject: "assunto e1", body: "b" },
    { id: "e2", offsetDays: 3, subject: "assunto e2", body: "b" },
    { id: "e3", offsetDays: 7, subject: "assunto e3", body: "b", withLink: true },
    { id: "e4", offsetDays: 7, subject: "assunto e4", body: "b" },
  ],
};

function send(over: Partial<SendRecord>): SendRecord {
  return {
    id: "s1",
    enrollmentId: "en1",
    contactId: "c1",
    campaignSlug: "camp-a",
    stepId: "e1",
    idempotencyKey: `camp-a/${over.contactId ?? "c1"}/${over.stepId ?? "e1"}`,
    status: "delivered",
    ...over,
  };
}

function enr(over: Partial<Enrollment>): Enrollment {
  return {
    id: "en1",
    contactId: "c1",
    campaignSlug: "camp-a",
    status: "active",
    nextStep: 0,
    createdAt: "2026-08-01T12:00:00Z",
    ...over,
  };
}

function reply(over: Partial<Reply>): Reply {
  return {
    id: "r1",
    contactId: "c1",
    campaignSlug: "camp-a",
    classification: "interested",
    receivedAt: "2026-08-05T12:00:00Z",
    recordedAt: "2026-08-05T13:00:00Z",
    ...over,
  };
}

function contact(over: Partial<Contact>): Contact {
  return {
    id: "c1",
    email: "c1@empresa-demo.example",
    nome: "Ana",
    custom: {},
    importBatchId: "i1",
    verification: "ok",
    status: "active",
    createdAt: "2026-07-01T12:00:00Z",
    ...over,
  };
}

describe("campaignMetrics", () => {
  it("conta envios por status/flag, respostas por classe e descadastros — só da campanha pedida", () => {
    const sends: SendRecord[] = [
      send({ id: "s1", status: "delivered", opened: true, clicked: true }),
      send({ id: "s2", status: "delivered", opened: true, contactId: "c2" }),
      send({ id: "s3", status: "sent", contactId: "c3" }),
      send({ id: "s4", status: "bounced", contactId: "c4" }),
      send({ id: "s5", status: "scheduled", contactId: "c5" }),
      send({ id: "s6", status: "pending", contactId: "c6" }),
      send({ id: "s7", status: "canceled", contactId: "c7" }),
      // outra campanha: não pode vazar para as métricas de camp-a
      send({ id: "s8", campaignSlug: "camp-b", status: "delivered", opened: true }),
      send({ id: "s9", campaignSlug: "camp-b", status: "complained" }),
    ];
    const enrollments: Enrollment[] = [
      enr({ id: "en1", status: "active" }),
      enr({ id: "en2", contactId: "c2", status: "replied", stopReason: "reply" }),
      enr({ id: "en3", contactId: "c3", status: "stopped", stopReason: "unsubscribe" }),
      enr({ id: "en4", contactId: "c4", status: "finished", nextStep: 4 }),
      enr({ id: "en5", campaignSlug: "camp-b", status: "active" }),
    ];
    const replies: Reply[] = [
      reply({ id: "r1", classification: "interested" }),
      reply({ id: "r2", contactId: "c2", classification: "interested" }),
      reply({ id: "r3", contactId: "c3", classification: "not_now" }),
      reply({ id: "r4", campaignSlug: "camp-b", classification: "interested" }),
    ];

    const m = campaignMetrics("camp-a", { sends, enrollments, replies });
    expect(m.enrollmentsTotal).toBe(4);
    expect(m.enrollmentsActive).toBe(1);
    expect(m.scheduled).toBe(1);
    expect(m.pending).toBe(1);
    // wasSent: sent + delivered + bounced (scheduled/pending/canceled ficam de fora)
    expect(m.sent).toBe(4);
    expect(m.delivered).toBe(2);
    expect(m.opened).toBe(2);
    expect(m.clicked).toBe(1);
    expect(m.repliesTotal).toBe(3);
    expect(m.interested).toBe(2);
    expect(m.repliesByClass.get("not_now")).toBe(1);
    expect(m.repliesByClass.has("negative")).toBe(false);
    expect(m.unsubscribes).toBe(1);
  });

  it("guard-rails avaliam só a campanha pedida (complaint de outra não dispara)", () => {
    const sends: SendRecord[] = [
      send({ id: "s1", status: "delivered" }),
      send({ id: "s2", campaignSlug: "camp-b", status: "complained" }),
    ];
    const a = campaignMetrics("camp-a", { sends, enrollments: [], replies: [] });
    expect(a.rails.complained).toBe(0);
    expect(a.rails.complaintTripped).toBe(false);
    const b = campaignMetrics("camp-b", { sends, enrollments: [], replies: [] });
    expect(b.rails.complaintTripped).toBe(true);
  });
});

describe("stepFunnel", () => {
  it("calcula planned/sent/replies por passo, atribuindo a resposta ao último passo enviado antes dela", () => {
    const enrollments: Enrollment[] = [
      // ativa no meio da sequência: conta como planejada em TODOS os passos
      enr({ id: "en1", contactId: "c1", status: "active", nextStep: 2 }),
      // respondeu depois do e1: planejada só no e1
      enr({ id: "en2", contactId: "c2", status: "replied", stopReason: "reply", nextStep: 1 }),
      // terminou a sequência inteira
      enr({ id: "en3", contactId: "c3", status: "finished", nextStep: 4 }),
    ];
    const sends: SendRecord[] = [
      send({ id: "s1", contactId: "c1", stepId: "e1", status: "delivered", sentAt: "2026-08-01T10:00:00Z" }),
      send({
        id: "s2",
        contactId: "c1",
        stepId: "e2",
        status: "delivered",
        opened: true,
        sentAt: "2026-08-04T10:00:00Z",
      }),
      // agendado ainda não saiu: não conta como enviado nem recebe atribuição de resposta
      send({ id: "s3", contactId: "c1", stepId: "e3", status: "scheduled", scheduledAt: "2026-08-10T10:00:00Z" }),
      send({ id: "s4", contactId: "c2", stepId: "e1", status: "delivered", sentAt: "2026-08-01T11:00:00Z" }),
      send({ id: "s5", contactId: "c3", stepId: "e1", status: "delivered", sentAt: "2026-08-01T12:00:00Z" }),
      send({ id: "s6", contactId: "c3", stepId: "e2", status: "delivered", sentAt: "2026-08-04T12:00:00Z" }),
      send({
        id: "s7",
        contactId: "c3",
        stepId: "e3",
        status: "delivered",
        clicked: true,
        sentAt: "2026-08-11T12:00:00Z",
      }),
      send({ id: "s8", contactId: "c3", stepId: "e4", status: "delivered", sentAt: "2026-08-18T12:00:00Z" }),
    ];
    const replies: Reply[] = [
      // chegou entre e1 e e2 do c2 → atribuída ao e1
      reply({ id: "r1", contactId: "c2", receivedAt: "2026-08-02T09:00:00Z" }),
      // chegou depois do e2 do c1 e DEPOIS do horário do e3 agendado — o agendado é
      // ignorado na atribuição, então continua no e2
      reply({ id: "r2", contactId: "c1", receivedAt: "2026-08-20T09:00:00Z", classification: "ooo" }),
    ];

    const rows = stepFunnel(DEF, { sends, enrollments, replies });
    expect(rows.map((r) => r.stepId)).toEqual(["e1", "e2", "e3", "e4"]);

    const [e1, e2, e3, e4] = rows;
    expect(e1!.planned).toBe(3); // en1 ativa + en2 (nextStep 1 > 0) + en3
    expect(e1!.sent).toBe(3);
    expect(e1!.delivered).toBe(3);
    expect(e1!.replies).toBe(1);

    expect(e2!.planned).toBe(2); // en2 parou no e1
    expect(e2!.sent).toBe(2);
    expect(e2!.opened).toBe(1);
    expect(e2!.replies).toBe(1);

    expect(e3!.planned).toBe(2);
    expect(e3!.sent).toBe(1); // o agendado (s3) não conta
    expect(e3!.clicked).toBe(1);
    expect(e3!.replies).toBe(0);

    expect(e4!.planned).toBe(2); // en1 ativa ainda pode chegar lá + en3
    expect(e4!.sent).toBe(1);
  });
});

describe("dailySendSeries", () => {
  const NOW = new Date("2026-08-26T15:00:00-03:00");

  it("inclui dias sem envio, conta bounce e agrupa pelo dia-calendário no fuso -03:00", () => {
    const sends: SendRecord[] = [
      send({ id: "s1", status: "delivered", scheduledAt: "2026-08-24T10:00:00-03:00" }),
      // sem scheduledAt: cai no sentAt
      send({ id: "s2", status: "bounced", sentAt: "2026-08-24T11:00:00-03:00" }),
      send({ id: "s3", status: "scheduled", scheduledAt: "2026-08-26T09:30:00-03:00" }),
      // 23:30 do dia 23 no fuso -03:00 é 02:30Z do dia 24 — tem de contar no dia 23
      send({ id: "s4", status: "delivered", scheduledAt: "2026-08-23T23:30:00-03:00" }),
      // cancelado não conta como envio
      send({ id: "s5", status: "canceled", scheduledAt: "2026-08-25T10:00:00-03:00" }),
      // fora da janela de N dias
      send({ id: "s6", status: "delivered", scheduledAt: "2026-08-10T10:00:00-03:00" }),
      // pending sem data nenhuma: ignorado
      send({ id: "s7", status: "pending" }),
    ];

    const series = dailySendSeries(sends, 4, NOW, "-03:00");
    expect(series.map((p) => p.date)).toEqual(["2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26"]);

    const [d23, d24, d25, d26] = series;
    expect(d23).toEqual({ date: "2026-08-23", sent: 1, delivered: 1, bounced: 0 });
    expect(d24).toEqual({ date: "2026-08-24", sent: 2, delivered: 1, bounced: 1 });
    expect(d25).toEqual({ date: "2026-08-25", sent: 0, delivered: 0, bounced: 0 }); // dia vazio presente
    expect(d26).toEqual({ date: "2026-08-26", sent: 1, delivered: 0, bounced: 0 }); // agendado conta como envio do dia
  });

  it("janela de 1 dia só olha hoje", () => {
    const sends: SendRecord[] = [
      send({ id: "s1", status: "delivered", scheduledAt: "2026-08-26T10:00:00-03:00" }),
      send({ id: "s2", status: "delivered", scheduledAt: "2026-08-25T10:00:00-03:00" }),
    ];
    const series = dailySendSeries(sends, 1, NOW, "-03:00");
    expect(series).toEqual([{ date: "2026-08-26", sent: 1, delivered: 1, bounced: 0 }]);
  });
});

describe("contactStats", () => {
  it("agrega por status, verificação e indústria (com aparo e rótulo para ausente)", () => {
    const contacts: Contact[] = [
      contact({ id: "c1", verification: "ok", status: "active", industria: "Indústria A" }),
      contact({ id: "c2", verification: "risky", status: "active", industria: "  Indústria A " }),
      contact({ id: "c3", verification: "invalid", status: "excluded" }),
      contact({ id: "c4", verification: "unverified", status: "suppressed", industria: "B" }),
    ];
    const stats = contactStats(contacts);
    expect(stats.total).toBe(4);
    expect(stats.byStatus).toEqual({ active: 2, excluded: 1, suppressed: 1 });
    expect(stats.byVerification).toEqual({ ok: 1, risky: 1, invalid: 1, unverified: 1 });
    expect(stats.byIndustry.get("Indústria A")).toBe(2);
    expect(stats.byIndustry.get("(sem indústria)")).toBe(1);
    expect(stats.byIndustry.get("B")).toBe(1);
    expect(stats.byIndustry.size).toBe(3);
  });

  it("base vazia devolve zeros (sem inventar linha)", () => {
    const stats = contactStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byStatus).toEqual({ active: 0, excluded: 0, suppressed: 0 });
    expect(stats.byIndustry.size).toBe(0);
  });
});
