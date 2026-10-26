import { randomUUID } from "node:crypto";
import { getOutboundEnv, sendDateKey } from "./config";
import type { OutboundStore } from "./store";
import type { Contact, CrmTask, Enrollment, SendRecord } from "./types";

/**
 * TOQUE NO LINKEDIN DEPOIS DO E1 (regra do Luigi, 2026-10-15; até então era um dia
 * ANTES, pela previsão da Agenda): um pedido de conexão com uma mensagem curta
 * ("te mandei um e-mail..."), só depois de o E1 ter saído de verdade. Se a
 * mensagem chegasse antes do e-mail, a pessoa respondia "não recebi" (caso
 * GYLOG, 14/10). O motor descobre quem já teve o E1 processado pelo provedor
 * (sent/delivered), cria UMA tarefa por contato (idempotente) vencendo hoje, e o
 * Hoje vira uma fila de cliques: abrir perfil → conectar → feito. O resultado
 * fica no contato (`custom.toque_previo`, nome mantido pela compatibilidade do
 * relatório) para medirmos resposta com e sem toque. Sem PII fora do store;
 * nada aqui toca no envio.
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

/**
 * Mensagem do convite no LinkedIn, já com o nome (texto do Luigi, 2026-10-26). O
 * Hoje copia isto para a área de transferência e abre o perfil num clique só.
 * Primeiro nome apenas, com a inicial maiúscula (o Clay às vezes manda tudo em
 * caixa alta). Cabe no limite do LinkedIn (≈175 caracteres + nome).
 */
export function mensagemConvite(contact: Pick<Contact, "nome">): string {
  const bruto = contact.nome.trim().split(/\s+/)[0] ?? "";
  const nome = bruto ? bruto.charAt(0).toLocaleUpperCase("pt-BR") + bruto.slice(1).toLocaleLowerCase("pt-BR") : "";
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  return `${saudacao} Vi seu perfil e te mandei um e-mail sobre uma solução que eu tenho em minha empresa. Achei que valia conectar por aqui também. Prazer, sou o Luigi, da Dreamy.`;
}

export interface CandidatoToque {
  contact: Contact;
  campaignSlug: string;
  /** Dia em que o E1 saiu (YYYY-MM-DD). */
  e1Em: string;
}

/** E1 que o provedor já processou: o e-mail existe na caixa (bounce não gera toque). */
const E1_SAIU: ReadonlySet<SendRecord["status"]> = new Set(["sent", "delivered"]);

/**
 * Quem JÁ RECEBEU o E1 (processado pelo provedor), está ativo, tem perfil no
 * LinkedIn e ainda não teve toque. Um contato conta uma vez, pelo E1 mais antigo.
 */
export function candidatosToquePrevio(input: {
  contacts: Contact[];
  sends: SendRecord[];
  hojeKey: string;
}): CandidatoToque[] {
  const byId = new Map(input.contacts.map((c) => [c.id, c]));
  const vistos = new Set<string>();
  const out: CandidatoToque[] = [];
  const quando = (s: SendRecord): string => s.sentAt ?? s.scheduledAt ?? "";
  const e1s = input.sends
    .filter((s) => s.stepId === "e1" && E1_SAIU.has(s.status))
    .sort((a, b) => quando(a).localeCompare(quando(b)));
  for (const send of e1s) {
    const contact = byId.get(send.contactId);
    if (!contact || contact.status !== "active" || vistos.has(contact.id)) continue;
    if ((contact.custom[TOQUE_PREVIO_CUSTOM] ?? "").trim() !== "") continue;
    if (!linkedinUrl(contact)) continue;
    vistos.add(contact.id);
    out.push({ contact, campaignSlug: send.campaignSlug, e1Em: quando(send).slice(0, 10) });
  }
  return out.sort(
    (a, b) =>
      a.e1Em.localeCompare(b.e1Em) ||
      (a.contact.empresa ?? "").localeCompare(b.contact.empresa ?? "") ||
      a.contact.nome.localeCompare(b.contact.nome),
  );
}

/**
 * Tarefas NOVAS (uma por contato que ainda não tem tarefa de toque aberta ou
 * concluída; uma CANCELADA não conta, porque foi cancelada justamente para ser
 * refeita no momento certo).
 */
export function planejarToquesPrevios(input: {
  candidatos: CandidatoToque[];
  tasks: CrmTask[];
  hojeKey: string;
  now?: Date;
}): CrmTask[] {
  const now = input.now ?? new Date();
  const jaTem = new Set(
    input.tasks
      .filter((t) => t.kind === TOQUE_PREVIO_KIND && t.contactId && t.status !== "cancelada")
      .map((t) => t.contactId as string),
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
 * Gera as tarefas no store (idempotente): roda no ciclo (`outbound:auto`, depois do
 * envio e do sync), na CLI (`outbound:crm toques`) e no botão do Hoje. Lê os envios
 * reais e grava só o que for novo.
 */
export async function gerarToquesPreviosNoStore(
  store: OutboundStore,
  now: Date = new Date(),
): Promise<{ criados: number; abertos: number; candidatos: number }> {
  const env = getOutboundEnv();
  const hojeKey = sendDateKey(now, env.utcOffset);
  const [contacts, sends, tasks] = await Promise.all([store.contacts(), store.sends(), store.tasks()]);
  const candidatos = candidatosToquePrevio({ contacts, sends, hojeKey });
  const novas = planejarToquesPrevios({ candidatos, tasks, hojeKey, now });
  if (novas.length > 0) {
    tasks.push(...novas);
    await store.saveTasks(tasks);
  }
  const abertos = tasks.filter((t) => t.kind === TOQUE_PREVIO_KIND && t.status === "aberta").length;
  return { criados: novas.length, abertos, candidatos: candidatos.length };
}
