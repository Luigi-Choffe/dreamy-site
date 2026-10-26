import { describe, expect, it } from "vitest";
import {
  candidatosToquePrevio,
  linkedinUrl,
  mensagemConvite,
  planejarToquesPrevios,
  progressoToques,
  registrarToque,
  toquesAbertos,
  TOQUE_PREVIO_CUSTOM,
  TOQUE_PREVIO_KIND,
} from "../../src/lib/outbound/toque-previo";
import type { Contact, CrmTask, Enrollment, SendRecord } from "../../src/lib/outbound/types";

function contact(id: string, over: Partial<Contact> = {}): Contact {
  return {
    id,
    email: `${id}@empresa.com.br`,
    nome: `Nome ${id}`,
    empresa: `Empresa ${id}`,
    linkedin: `https://www.linkedin.com/in/${id}`,
    custom: {},
    importBatchId: "b1",
    verification: "ok",
    status: "active",
    createdAt: "2026-09-10T12:00:00Z",
    ...over,
  };
}

function send(
  contactId: string,
  status: SendRecord["status"],
  sentAt: string,
  stepId = "e1",
  campaignSlug = "logistica-estoque-receita",
): SendRecord {
  return {
    id: `s-${contactId}-${stepId}`,
    enrollmentId: `en-${contactId}`,
    contactId,
    campaignSlug,
    stepId,
    idempotencyKey: `${campaignSlug}/${contactId}/${stepId}`,
    status,
    scheduledAt: sentAt,
    sentAt,
  } as SendRecord;
}

const HOJE = "2026-09-11";
// a e c já receberam o E1; b só recebeu um E3; d tem E1 entregue mas sem perfil;
// e está só AGENDADO (ainda não saiu); f bounceou.
const sends: SendRecord[] = [
  send("a", "delivered", "2026-09-10T14:00:00-03:00"),
  send("b", "delivered", "2026-09-10T15:00:00-03:00", "e3", "construcao-nova-receita"),
  send("c", "sent", "2026-09-11T09:30:00-03:00"),
  send("d", "delivered", "2026-09-11T09:40:00-03:00"),
  send("e", "scheduled", "2026-09-11T16:00:00-03:00"),
  send("f", "bounced", "2026-09-10T14:10:00-03:00"),
];

describe("linkedinUrl", () => {
  it("normaliza esquema e rejeita host que não é LinkedIn ou perfil vazio", () => {
    expect(linkedinUrl({ linkedin: "linkedin.com/in/fulano" })).toBe("https://linkedin.com/in/fulano");
    expect(linkedinUrl({ linkedin: "https://www.linkedin.com/in/fulano/" })).toBe(
      "https://www.linkedin.com/in/fulano/",
    );
    expect(linkedinUrl({ linkedin: "https://twitter.com/fulano" })).toBeNull();
    expect(linkedinUrl({ linkedin: "  " })).toBeNull();
    expect(linkedinUrl({})).toBeNull();
  });
});

describe("candidatosToquePrevio (regra de 15/10: só depois do E1 ter saído)", () => {
  it("pega quem já teve o E1 processado (sent/delivered); ignora agendado, bounce, outro passo e quem não tem perfil", () => {
    const contacts = [
      contact("a"),
      contact("b"),
      contact("c"),
      contact("d", { linkedin: undefined }),
      contact("e"),
      contact("f"),
    ];
    const out = candidatosToquePrevio({ contacts, sends, hojeKey: HOJE });
    expect(out.map((c) => `${c.contact.id}@${c.e1Em}`)).toEqual(["a@2026-09-10", "c@2026-09-11"]);
    expect(out[1]?.campaignSlug).toBe("logistica-estoque-receita");
  });
  it("ignora contato inativo e quem já teve toque", () => {
    const contacts = [
      contact("a", { status: "excluded" }),
      contact("c", { custom: { [TOQUE_PREVIO_CUSTOM]: "enviado 2026-09-10" } }),
    ];
    expect(candidatosToquePrevio({ contacts, sends, hojeKey: HOJE })).toEqual([]);
  });
});

describe("planejarToquesPrevios", () => {
  const contacts = [contact("a"), contact("c")];
  const candidatos = candidatosToquePrevio({ contacts, sends, hojeKey: HOJE });

  it("cria uma tarefa de regra por candidato, vencendo hoje, com kind e título legível", () => {
    const novas = planejarToquesPrevios({
      candidatos,
      tasks: [],
      hojeKey: HOJE,
      now: new Date("2026-09-11T12:00:00Z"),
    });
    expect(novas).toHaveLength(2);
    expect(novas[0]).toMatchObject({
      kind: TOQUE_PREVIO_KIND,
      contactId: "a",
      dueDate: HOJE,
      status: "aberta",
      origin: "regra",
      createdBy: "sistema",
    });
    expect(novas[0]?.titulo).toBe("Conectar no LinkedIn: Nome a · Empresa a");
  });
  it("é idempotente: tarefa existente (aberta OU concluída) bloqueia a repetição", () => {
    const primeira = planejarToquesPrevios({ candidatos, tasks: [], hojeKey: HOJE });
    const segunda = planejarToquesPrevios({ candidatos, tasks: primeira, hojeKey: HOJE });
    expect(segunda).toEqual([]);
    const concluida = primeira.map((t) => ({ ...t, status: "concluida" as const }));
    expect(planejarToquesPrevios({ candidatos, tasks: concluida, hojeKey: HOJE })).toEqual([]);
  });
  it("tarefa CANCELADA não bloqueia: foi cancelada para ser refeita depois do E1", () => {
    const primeira = planejarToquesPrevios({ candidatos, tasks: [], hojeKey: HOJE });
    const canceladas = primeira.map((t) => ({ ...t, status: "cancelada" as const }));
    expect(planejarToquesPrevios({ candidatos, tasks: canceladas, hojeKey: HOJE })).toHaveLength(2);
  });
});

describe("fila do Hoje e registro", () => {
  const contacts = [contact("a"), contact("c", { linkedin: "nada" })];
  const enrollments: Enrollment[] = [
    {
      id: "en-a",
      contactId: "a",
      campaignSlug: "logistica-estoque-receita",
      status: "active",
      nextStep: 0,
      createdAt: "x",
    },
  ];
  const tasks: CrmTask[] = planejarToquesPrevios({
    candidatos: [
      { contact: contacts[0] as Contact, campaignSlug: "logistica-estoque-receita", e1Em: HOJE },
      { contact: contacts[1] as Contact, campaignSlug: "logistica-estoque-receita", e1Em: HOJE },
    ],
    tasks: [],
    hojeKey: HOJE,
  });

  it("toquesAbertos junta contato, URL (ou null se o perfil sumiu) e campanha ativa", () => {
    const fila = toquesAbertos(tasks, contacts, enrollments);
    expect(fila).toHaveLength(2);
    expect(fila[0]?.url).toBe("https://www.linkedin.com/in/a");
    expect(fila[0]?.campaignSlug).toBe("logistica-estoque-receita");
    expect(fila[1]?.url).toBeNull();
  });
  it("registrarToque conclui a tarefa e carimba o contato; o progresso do dia acompanha", () => {
    const now = new Date("2026-09-11T14:00:00Z");
    registrarToque(contacts[0] as Contact, tasks[0] as CrmTask, "enviado", HOJE, now);
    expect(tasks[0]?.status).toBe("concluida");
    expect(tasks[0]?.doneAt).toBe(now.toISOString());
    expect(contacts[0]?.custom[TOQUE_PREVIO_CUSTOM]).toBe("enviado 2026-09-11");
    expect(progressoToques(tasks, HOJE)).toEqual({ feitos: 1, abertos: 1 });
    expect(toquesAbertos(tasks, contacts, enrollments)).toHaveLength(1);
  });
});

describe("mensagemConvite (texto do Luigi, 2026-10-26)", () => {
  it("usa só o primeiro nome, com inicial maiúscula, e cabe no convite do LinkedIn", () => {
    const m = mensagemConvite({ nome: "ALLAN RODRIGUES" });
    expect(m).toBe(
      "Olá, Allan! Vi seu perfil e te mandei um e-mail sobre uma solução que eu tenho em minha empresa. Achei que valia conectar por aqui também. Prazer, sou o Luigi, da Dreamy.",
    );
    expect(m.length).toBeLessThanOrEqual(200);
    expect(mensagemConvite({ nome: "lívia" })).toMatch(/^Olá, Lívia! /);
  });
  it("sem nome, cumprimenta sem o nome em vez de deixar um buraco", () => {
    expect(mensagemConvite({ nome: "  " })).toMatch(/^Olá! Vi seu perfil/);
  });
});
