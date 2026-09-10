import { randomUUID } from "node:crypto";
import type { ForecastDay } from "./agenda-core";
import { forecastCadence } from "./agenda-core";
import { getOutboundEnv, sendDateKey } from "./config";
import type { OutboundStore } from "./store";
import type { CampaignDefinition, Contact, CrmTask, Enrollment } from "./types";

/**
 * TOQUE PRÉVIO NO LINKEDIN (ordem do Luigi, 2026-09-10): um pedido de conexão,
 * sem mensagem, um dia antes do E1. Quem já viu o rosto do remetente responde
 * mais. O motor descobre quem recebe E1 hoje ou no próximo dia de envio (a
 * mesma previsão da Agenda), cria UMA tarefa por contato (idempotente) vencendo
 * hoje, e o Hoje vira uma fila de cliques: abrir perfil → conectar → feito.
 * O resultado fica no contato (`custom.toque_previo`) para medirmos resposta
 * com e sem toque. Sem PII fora do store; nada aqui toca no envio.
 */

export const TOQUE_PREVIO_KIND = "toque-previo" as const;
/** Chave em contact.custom: "enviado 2026-09-11" | "sem-perfil 2026-09-11" | "pulado 2026-09-11". */
export const TOQUE_PREVIO_CUSTOM = "toque_previo";
export type ToqueResultado = "enviado" | "sem-perfil" | "pulado";
export const TOQUE_RESULTADOS: readonly ToqueResultado[] = ["enviado", "sem-perfil", "pulado"];

/** URL de perfil normalizada (https, host linkedin.com) ou null quando não há perfil utilizável. */
export function linkedinUrl(contact: Pick<Contact, "linkedin">): string | null {
  const raw = contact.linkedin?.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export interface CandidatoToque {
  contact: Contact;
  campaignSlug: string;
  /** Dia previsto do E1 (YYYY-MM-DD). */
  e1Em: string;
}

/**
 * Quem recebe E1 HOJE ou no PRÓXIMO dia de envio previsto, está ativo, tem perfil
 * no LinkedIn e ainda não teve toque. Um contato conta uma vez.
 */
export function candidatosToquePrevio(input: {
  contacts: Contact[];
  forecastDays: ForecastDay[];
  hojeKey: string;
}): CandidatoToque[] {
  const hoje = input.forecastDays.find((d) => d.dateKey === input.hojeKey);
  const proximo = input.forecastDays.find((d) => d.dateKey > input.hojeKey);
  const byId = new Map(input.contacts.map((c) => [c.id, c]));
  const vistos = new Set<string>();
  const out: CandidatoToque[] = [];
  for (const day of [hoje, proximo]) {
    if (!day) continue;
    for (const item of day.items) {
      if (item.stepId !== "e1") continue;
      const contact = byId.get(item.contactId);
      if (!contact || contact.status !== "active" || vistos.has(contact.id)) continue;
      if ((contact.custom[TOQUE_PREVIO_CUSTOM] ?? "").trim() !== "") continue;
      if (!linkedinUrl(contact)) continue;
      vistos.add(contact.id);
      out.push({ contact, campaignSlug: item.campaignSlug, e1Em: day.dateKey });
    }
  }
  return out.sort(
    (a, b) =>
      a.e1Em.localeCompare(b.e1Em) ||
      (a.contact.empresa ?? "").localeCompare(b.contact.empresa ?? "") ||
      a.contact.nome.localeCompare(b.contact.nome),
  );
}

/** Tarefas NOVAS (uma por contato que ainda não tem tarefa de toque, aberta ou concluída). */
export function planejarToquesPrevios(input: {
  candidatos: CandidatoToque[];
  tasks: CrmTask[];
  hojeKey: string;
  now?: Date;
}): CrmTask[] {
  const now = input.now ?? new Date();
  const jaTem = new Set(
    input.tasks.filter((t) => t.kind === TOQUE_PREVIO_KIND && t.contactId).map((t) => t.contactId as string),
  );
  return input.candidatos
    .filter((c) => !jaTem.has(c.contact.id))
    .map((c) => ({
      id: randomUUID(),
      kind: TOQUE_PREVIO_KIND,
      titulo: `Conectar no LinkedIn: ${[c.contact.nome, c.contact.sobrenome].filter(Boolean).join(" ")} · ${c.contact.empresa ?? "sem empresa"}`,
      contactId: c.contact.id,
      dueDate: input.hojeKey,
      status: "aberta" as const,
      origin: "regra" as const,
      createdBy: "sistema",
      createdAt: now.toISOString(),
    }));
}

export interface ToqueAberto {
  task: CrmTask;
  contact: Contact;
  /** null = perfil sumiu/inválido desde a criação: a linha oferece "sem perfil". */
  url: string | null;
  campaignSlug?: string;
}

/** Fila do Hoje: tarefas de toque abertas com o contato e a campanha ativa dele. */
export function toquesAbertos(tasks: CrmTask[], contacts: Contact[], enrollments: Enrollment[]): ToqueAberto[] {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const campanhaDo = new Map<string, string>();
  for (const e of enrollments) if (e.status === "active") campanhaDo.set(e.contactId, e.campaignSlug);
  const out: ToqueAberto[] = [];
  for (const task of tasks) {
    if (task.kind !== TOQUE_PREVIO_KIND || task.status !== "aberta" || !task.contactId) continue;
    const contact = byId.get(task.contactId);
    if (!contact) continue;
    out.push({ task, contact, url: linkedinUrl(contact), campaignSlug: campanhaDo.get(contact.id) });
  }
  return out.sort(
    (a, b) =>
      (a.contact.empresa ?? "").localeCompare(b.contact.empresa ?? "") || a.contact.nome.localeCompare(b.contact.nome),
  );
}

/** Progresso do dia para a barra do Hoje: feitos hoje vs. ainda abertos. */
export function progressoToques(tasks: CrmTask[], hojeKey: string): { feitos: number; abertos: number } {
  let feitos = 0;
  let abertos = 0;
  for (const t of tasks) {
    if (t.kind !== TOQUE_PREVIO_KIND) continue;
    if (t.status === "aberta" && t.dueDate <= hojeKey) abertos += 1;
    else if (t.status === "concluida" && t.dueDate === hojeKey) feitos += 1;
  }
  return { feitos, abertos };
}

/** Conclui a tarefa e carimba o resultado no contato (é o que o relatório lê depois). Muta os objetos. */
export function registrarToque(
  contact: Contact,
  task: CrmTask,
  resultado: ToqueResultado,
  hojeKey: string,
  now: Date,
): void {
  task.status = "concluida";
  task.doneAt = now.toISOString();
  contact.custom[TOQUE_PREVIO_CUSTOM] = `${resultado} ${hojeKey}`;
}

/**
 * Gera as tarefas no store (idempotente): roda no ciclo (`outbound:auto`), na CLI
 * (`outbound:crm toques`) e no botão do Hoje. Lê a previsão da Agenda (5 dias
 * cobrem sexta → segunda) e grava só o que for novo.
 */
export async function gerarToquesPreviosNoStore(
  store: OutboundStore,
  campaignDefs: CampaignDefinition[],
  now: Date = new Date(),
): Promise<{ criados: number; abertos: number; candidatos: number }> {
  const env = getOutboundEnv();
  const hojeKey = sendDateKey(now, env.utcOffset);
  const [contacts, enrollments, sends, suppressions, runtimes, state, tasks] = await Promise.all([
    store.contacts(),
    store.enrollments(),
    store.sends(),
    store.suppressions(),
    store.campaignRuntimes(),
    store.state(),
    store.tasks(),
  ]);
  const forecast = forecastCadence(
    { contacts, enrollments, sends, suppressions, campaignDefs, runtimes, state, env, now },
    5,
  );
  const candidatos = candidatosToquePrevio({ contacts, forecastDays: forecast.days, hojeKey });
  const novas = planejarToquesPrevios({ candidatos, tasks, hojeKey, now });
  if (novas.length > 0) {
    tasks.push(...novas);
    await store.saveTasks(tasks);
  }
  const abertos = tasks.filter((t) => t.kind === TOQUE_PREVIO_KIND && t.status === "aberta").length;
  return { criados: novas.length, abertos, candidatos: candidatos.length };
}
