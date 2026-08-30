import { describe, expect, it } from "vitest";
import { buildAgenda, forecastCadence } from "../../src/lib/outbound/agenda-core";
import type { OutboundEnv } from "../../src/lib/outbound/config";
import { campaignContentHash } from "../../src/lib/outbound/render";
import type { CampaignDefinition, Contact, CrmTask, Deal, Enrollment } from "../../src/lib/outbound/types";

const ENV: OutboundEnv = {
  apiKey: null,
  from: null,
  replyTo: "contato@teste.com.br",
  anthropicKey: null,
  utcOffset: "-03:00",
  window: { startMin: 9 * 60, endMin: 17 * 60 + 30 },
  dailyCapEnv: null,
};

const CORPO =
  "vi que a operação de vocês cresceu bastante neste ano e fiquei curioso para entender como o time está " +
  "organizando essa parte no dia a dia. faz sentido a gente conversar sobre isso na semana que vem?";

const DEF: CampaignDefinition = {
  slug: "agenda-teste",
  industria: "distribuição",
  anchor: "sistema",
  status: "ready",
  steps: [
    { id: "e1", offsetDays: 0, subject: "assunto de teste do primeiro passo", body: CORPO },
    { id: "e2", offsetDays: 3, subject: "assunto de teste do segundo passo", body: CORPO },
  ],
};

function contact(id: string): Contact {
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
  };
}

function enrollment(contactId: string): Enrollment {
  return {
    id: `en-${contactId}`,
    contactId,
    campaignSlug: DEF.slug,
    status: "active",
    nextStep: 0,
    createdAt: "2026-08-28T12:00:00Z",
  };
}

// Segunda-feira 2026-08-31, 08:30 em São Paulo (antes da janela abrir).
const MONDAY = new Date("2026-08-31T11:30:00Z");

const BASE = {
  contacts: [contact("c1"), contact("c2")],
  enrollments: [enrollment("c1"), enrollment("c2")],
  sends: [],
  suppressions: [],
  campaignDefs: [DEF],
  runtimes: [{ slug: DEF.slug, approvedAt: "2026-08-29T12:00:00Z", approvedHash: campaignContentHash(DEF) }],
  state: { armed: true },
  env: ENV,
  now: MONDAY,
};

describe("forecastCadence", () => {
  it("projeta a cadência dia a dia respeitando hora do envio, sem tocar a entrada", () => {
    const before = JSON.stringify(BASE.enrollments);
    const forecast = forecastCadence(BASE, 5);
    // seg a sex = 5 dias úteis no horizonte
    expect(forecast.days.map((d) => d.dateKey)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
    const byKey = new Map(forecast.days.map((d) => [d.dateKey, d.items]));
    expect(byKey.get("2026-08-31")?.map((i) => i.stepId)).toEqual(["e1", "e1"]);
    expect(byKey.get("2026-09-01")).toHaveLength(0);
    // Cadência conta HORA: c1 (enviado 09:00 de seg) vence qui; c2 (13:15) só vence na sexta.
    expect(byKey.get("2026-09-03")?.map((i) => i.contactId)).toEqual(["c1"]);
    expect(byKey.get("2026-09-04")?.map((i) => i.contactId)).toEqual(["c2"]);
    expect(forecast.blockedReason).toBeUndefined();
    expect(JSON.stringify(BASE.enrollments)).toBe(before);
  });

  it("breaker disparado bloqueia a previsão em vez de fingir futuro", () => {
    const forecast = forecastCadence(
      { ...BASE, state: { armed: true, breakerTrippedAt: "2026-08-30T12:00:00Z", breakerReason: "complaint" } },
      5,
    );
    expect(forecast.blockedReason).toMatch(/breaker/i);
    expect(forecast.days).toHaveLength(0);
  });
});

describe("buildAgenda", () => {
  it("une previsão, fila real do Resend, tarefas e reuniões por dia", () => {
    const tasks: CrmTask[] = [
      {
        id: "t1",
        titulo: "Ligar para o interessado",
        contactId: "c1",
        dueDate: "2026-09-01",
        status: "aberta",
        origin: "manual",
        createdBy: "mork",
        createdAt: "2026-08-30T12:00:00Z",
      },
      {
        id: "t2",
        titulo: "Vencida da semana passada",
        dueDate: "2026-08-28",
        status: "aberta",
        origin: "manual",
        createdBy: "mork",
        createdAt: "2026-08-25T12:00:00Z",
      },
    ];
    const deals: Deal[] = [
      {
        id: "d1",
        contactId: "c2",
        empresa: "Empresa c2",
        stage: "reuniao_marcada",
        reuniaoEm: "2026-09-02T14:00:00-03:00",
        stageHistory: [{ stage: "reuniao_marcada", at: "2026-08-30T12:00:00Z", by: "x" }],
        stageChangedAt: "2026-08-30T12:00:00Z",
        stageChangedBy: "x",
        createdAt: "2026-08-25T12:00:00Z",
      },
    ];
    const agendados = [
      {
        id: "s-real",
        enrollmentId: "en-c1",
        contactId: "c1",
        campaignSlug: DEF.slug,
        stepId: "e1",
        idempotencyKey: `${DEF.slug}/c1/e1`,
        status: "scheduled" as const,
        scheduledAt: "2026-08-31T14:00:00-03:00",
      },
    ];
    const agenda = buildAgenda({ ...BASE, sends: agendados, tasks, deals }, 5);
    const byKey = new Map(agenda.days.map((d) => [d.dateKey, d]));

    // c1 já está na fila REAL de hoje; a previsão de hoje então só tem o c2.
    expect(byKey.get("2026-08-31")?.agendados.map((s) => s.id)).toEqual(["s-real"]);
    expect(byKey.get("2026-08-31")?.previstos.map((i) => i.contactId)).toEqual(["c2"]);
    expect(byKey.get("2026-09-01")?.tarefas.map((t) => t.id)).toEqual(["t1"]);
    expect(byKey.get("2026-09-02")?.reunioes.map((d) => d.id)).toEqual(["d1"]);
    expect(agenda.tarefasAtrasadas).toBe(1);
  });
});
