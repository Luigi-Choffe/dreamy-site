"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/observability/logger";
import { requireSession } from "@/lib/outbound/auth";
import { applyStageMove, buildManualDeal, DEAL_STAGES, reconcileDeals } from "@/lib/outbound/crm-core";
import { newId, openStore, runExclusive, type OutboundStore } from "@/lib/outbound/store";
import type { DealStage } from "@/lib/outbound/types";
import { demoDir } from "./data";

/**
 * Server Actions do CRM piloto (PRD §29). Mesmo contrato das actions do outbound:
 * sessão obrigatória ANTES do lock, demo opera em `.outbound-demo/`, mutação curta
 * sob `runExclusive`. Nada aqui toca no motor de envio nem na API do Resend:
 * mover negócio NÃO pausa nem cancela e-mail (isso é ação separada, com aviso na UI).
 */

interface CrmContext {
  store: OutboundStore;
  isDemo: boolean;
  /** E-mail da sessão (auditoria de stageHistory/notas). */
  email: string;
}

async function withCrmContext<T>(formData: FormData, label: string, fn: (ctx: CrmContext) => Promise<T>): Promise<T> {
  const session = await requireSession();
  const isDemo = formData.get("demo") === "1";
  const dir = isDemo ? demoDir() : undefined;
  return runExclusive(
    label,
    async () => {
      const store = dir ? openStore(dir) : openStore();
      const result = await fn({ store, isDemo, email: session.email });
      revalidatePath("/interno/outbound", "layout");
      return result;
    },
    dir,
  );
}

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Campo obrigatório ausente: ${name}.`);
  return value.trim();
}

function optionalString(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** "2026-09-03T14:00" (datetime-local) → ISO no fuso de envio; ISO completo passa direto. */
function normalizeReuniao(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00-03:00`;
  return value;
}

function optionalValor(formData: FormData, name: string): number | undefined {
  const raw = optionalString(formData, name);
  if (raw === undefined) return undefined;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor estimado inválido (use um número em reais).");
  return Math.round(n);
}

/** Sincroniza o pipeline com o outbound (botão do console; idempotente). */
export async function reconcileDealsAction(formData: FormData): Promise<void> {
  await withCrmContext(formData, "crm-reconcile", async ({ store, isDemo }) => {
    const [contacts, enrollments, sends, replies, deals] = await Promise.all([
      store.contacts(),
      store.enrollments(),
      store.sends(),
      store.replies(),
      store.deals(),
    ]);
    const result = reconcileDeals({ contacts, enrollments, sends, replies, deals });
    if (result.created > 0 || result.advanced > 0) {
      await store.saveDeals(result.deals);
      const activities = await store.agentActivities();
      activities.push({
        id: newId(),
        actor: "console",
        kind: "crm",
        summary: `Pipeline sincronizado: ${result.created} negócio(s) criado(s), ${result.advanced} avançado(s).`,
        at: new Date().toISOString(),
      });
      await store.saveAgentActivities(activities);
    }
    logger.info("outbound.crm.reconcile", { isDemo, created: result.created, advanced: result.advanced });
  });
}

/** Move um negócio de estágio (reunião/proposta/ganho/perdido são sempre humanos). */
export async function moveDealStageAction(formData: FormData): Promise<void> {
  const dealId = requiredString(formData, "dealId");
  const stage = requiredString(formData, "stage");
  if (!(DEAL_STAGES as string[]).includes(stage)) throw new Error(`Estágio inválido: ${stage}.`);
  const motivo = optionalString(formData, "motivo");
  const reuniaoEm = normalizeReuniao(optionalString(formData, "reuniaoEm"));
  const valorEstimado = optionalValor(formData, "valor");
  await withCrmContext(formData, "crm-move", async ({ store, isDemo, email }) => {
    const deals = await store.deals();
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negócio não encontrado.");
    const changed = applyStageMove(deal, { to: stage as DealStage, by: email, motivo, reuniaoEm, valorEstimado });
    if (changed || valorEstimado !== undefined) await store.saveDeals(deals);
    logger.info("outbound.crm.move", { dealId, stage, isDemo, changed });
  });
}

/** Nota da conta — append-only (sem editar nem excluir no v1). */
export async function addNoteAction(formData: FormData): Promise<void> {
  const contactId = requiredString(formData, "contactId");
  const body = requiredString(formData, "body");
  await withCrmContext(formData, "crm-note", async ({ store, isDemo, email }) => {
    const contacts = await store.contacts();
    if (!contacts.some((c) => c.id === contactId)) throw new Error("Contato não encontrado.");
    const deal = (await store.deals()).find((d) => d.contactId === contactId);
    const notes = await store.notes();
    notes.push({
      id: newId(),
      contactId,
      dealId: deal?.id,
      authorEmail: email,
      body,
      origin: "manual",
      createdAt: new Date().toISOString(),
    });
    await store.saveNotes(notes);
    logger.info("outbound.crm.note", { contactId, isDemo });
  });
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createTaskAction(formData: FormData): Promise<void> {
  const titulo = requiredString(formData, "titulo");
  const dueDate = requiredString(formData, "dueDate");
  if (!DATE_KEY_RE.test(dueDate)) throw new Error("Data da tarefa inválida (use AAAA-MM-DD).");
  const contactId = optionalString(formData, "contactId");
  await withCrmContext(formData, "crm-task-create", async ({ store, isDemo, email }) => {
    if (contactId) {
      const contacts = await store.contacts();
      if (!contacts.some((c) => c.id === contactId)) throw new Error("Contato não encontrado.");
    }
    const deal = contactId ? (await store.deals()).find((d) => d.contactId === contactId) : undefined;
    const tasks = await store.tasks();
    tasks.push({
      id: newId(),
      titulo,
      contactId,
      dealId: deal?.id,
      dueDate,
      status: "aberta",
      origin: "manual",
      createdBy: email,
      createdAt: new Date().toISOString(),
    });
    await store.saveTasks(tasks);
    logger.info("outbound.crm.task.create", { contactId: contactId ?? null, isDemo });
  });
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const taskId = requiredString(formData, "taskId");
  await withCrmContext(formData, "crm-task-done", async ({ store, isDemo }) => {
    const tasks = await store.tasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("Tarefa não encontrada.");
    if (task.status !== "aberta") return;
    task.status = "concluida";
    task.doneAt = new Date().toISOString();
    await store.saveTasks(tasks);
    logger.info("outbound.crm.task.done", { taskId, isDemo });
  });
}

export async function rescheduleTaskAction(formData: FormData): Promise<void> {
  const taskId = requiredString(formData, "taskId");
  const dueDate = requiredString(formData, "dueDate");
  if (!DATE_KEY_RE.test(dueDate)) throw new Error("Data da tarefa inválida (use AAAA-MM-DD).");
  await withCrmContext(formData, "crm-task-reschedule", async ({ store, isDemo }) => {
    const tasks = await store.tasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("Tarefa não encontrada.");
    if (task.status !== "aberta") throw new Error("Só tarefa aberta pode ser reagendada.");
    task.dueDate = dueDate;
    await store.saveTasks(tasks);
    logger.info("outbound.crm.task.reschedule", { taskId, isDemo });
  });
}

/** Negócio manual (prospect fora do outbound) — um por contato. */
export async function createDealAction(formData: FormData): Promise<void> {
  const contactId = requiredString(formData, "contactId");
  const valorEstimado = optionalValor(formData, "valor");
  await withCrmContext(formData, "crm-create", async ({ store, isDemo, email }) => {
    const contacts = await store.contacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new Error("Contato não encontrado.");
    const deals = await store.deals();
    if (deals.some((d) => d.contactId === contactId)) throw new Error("Este contato já tem um negócio no pipeline.");
    deals.push(buildManualDeal({ contact, by: email, valorEstimado }));
    await store.saveDeals(deals);
    logger.info("outbound.crm.create", { contactId, isDemo });
  });
}

const OFFER_ANCHORS = ["nova-receita", "sistema", "agente-ia"] as const;

/**
 * Marca do workspace (singleton). APRESENTAÇÃO apenas: muda o topo do console e a
 * história das ofertas nas telas; JAMAIS alimenta copy, assinatura ou motor (ADR-020).
 */
export async function saveSettingsAction(formData: FormData): Promise<void> {
  const empresaNome = requiredString(formData, "empresaNome");
  const operadorNome = optionalString(formData, "operadorNome");
  const ofertas = OFFER_ANCHORS.map((anchor) => ({
    anchor,
    titulo: requiredString(formData, `oferta-${anchor}-titulo`),
    descricao: requiredString(formData, `oferta-${anchor}-descricao`),
  }));
  await withCrmContext(formData, "crm-settings", async ({ store, isDemo, email }) => {
    await store.saveWorkspaceSettings([
      {
        id: "workspace",
        empresaNome,
        operadorNome,
        ofertas,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: email,
      },
    ]);
    logger.info("outbound.crm.settings", { isDemo });
  });
}
