import { describe, expect, it } from "vitest";
import type { ForecastDay } from "../../src/lib/outbound/agenda-core";
import {
  candidatosToquePrevio,
  linkedinUrl,
  planejarToquesPrevios,
  progressoToques,
  registrarToque,
  toquesAbertos,
  TOQUE_PREVIO_CUSTOM,
  TOQUE_PREVIO_KIND,
} from "../../src/lib/outbound/toque-previo";
import type { Contact, CrmTask, Enrollment, PlanItem } from "../../src/lib/outbound/types";

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

function item(contactId: string, stepId = "e1", campaignSlug = "logistica-estoque-receita"): PlanItem {
  return { contactId, enrollmentId: `en-${contactId}`, campaignSlug, stepId } as PlanItem;
}

const HOJE = "2026-09-11";
const forecast: ForecastDay[] = [
  { dateKey: "2026-09-11", items: [item("a"), item("b", "e3", "construcao-nova-receita")] },
  { dateKey: "2026-09-14", items: [item("c"), item("d"), item("a")] },
  { dateKey: "2026-09-15", items: [item("e")] },
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

describe("candidatosToquePrevio", () => {
  it("pega só E1 de hoje e do PRÓXIMO dia de envio (pula quinta → segunda), um contato uma vez, só com perfil", () => {
    const contacts = [contact("a"), contact("b"), contact("c"), contact("d", { linkedin: undefined }), contact("e")];
    const out = candidatosToquePrevio({ contacts, forecastDays: forecast, hojeKey: HOJE });
    expect(out.map((c) => `${c.contact.id}@${c.e1Em}`)).toEqual(["a@2026-09-11", "c@2026-09-14"]);
    expect(out[1]?.campaignSlug).toBe("logistica-estoque-receita");
  });
  it("ignora contato inativo e quem já teve toque", () => {
    const contacts = [
      contact("a", { status: "excluded" }),
      contact("c", { custom: { [TOQUE_PREVIO_CUSTOM]: "enviado 2026-09-10" } }),
    ];
    expect(candidatosToquePrevio({ contacts, forecastDays: forecast, hojeKey: HOJE })).toEqual([]);
  });
});

describe("planejarToquesPrevios", () => {
  const contacts = [contact("a"), contact("c")];
  const candidatos = candidatosToquePrevio({ contacts, forecastDays: forecast, hojeKey: HOJE });

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
