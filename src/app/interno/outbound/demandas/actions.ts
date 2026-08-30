"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/observability/logger";
import { logAgentActivity } from "@/lib/outbound/agent-log";
import { requireSession } from "@/lib/outbound/auth";
import { applyDemandTransition, buildDemand, DEMAND_KINDS } from "@/lib/outbound/demands-core";
import { openStore, runExclusive, type OutboundStore } from "@/lib/outbound/store";
import type { DemandKind, DemandStatus } from "@/lib/outbound/types";
import { demoDir } from "../data";

/**
 * Actions da fila de demandas (PRD §29): o time pede pelo console; o MORK consome
 * pela CLI `outbound:demandas` no MESMO store (banco compartilhado). Mesmo contrato
 * das demais actions: sessão antes do lock, demo em `.outbound-demo/`, mutação curta.
 */

interface DemandContext {
  store: OutboundStore;
  isDemo: boolean;
  email: string;
}

async function withDemandContext<T>(
  formData: FormData,
  label: string,
  fn: (ctx: DemandContext) => Promise<T>,
): Promise<T> {
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

export async function createDemandAction(formData: FormData): Promise<void> {
  const title = requiredString(formData, "title");
  const kind = requiredString(formData, "kind");
  if (!(DEMAND_KINDS as string[]).includes(kind)) throw new Error(`Tipo de demanda inválido: ${kind}.`);
  const details = optionalString(formData, "details");
  const priority = formData.get("priority") === "alta" ? ("alta" as const) : ("normal" as const);
  const campaignSlug = optionalString(formData, "campaignSlug");
  const contactId = optionalString(formData, "contactId");
  await withDemandContext(formData, "demand-create", async ({ store, isDemo, email }) => {
    if (contactId) {
      const contacts = await store.contacts();
      if (!contacts.some((c) => c.id === contactId)) {
        throw new Error("Contato não encontrado (o vínculo é pelo id do contato).");
      }
    }
    const demand = buildDemand({
      title,
      details,
      kind: kind as DemandKind,
      priority,
      createdBy: email,
      campaignSlug,
      contactId,
    });
    const demands = await store.demands();
    demands.push(demand);
    await store.saveDemands(demands);
    await logAgentActivity(store, {
      actor: "console",
      kind: "demanda",
      summary: `Demanda criada: ${demand.title}`,
      refs: { demandId: demand.id, campaignSlug, contactId },
    });
    logger.info("outbound.demand.create", { demandId: demand.id, kind, priority, isDemo });
  });
}

const CONSOLE_TRANSITIONS: DemandStatus[] = ["em_andamento", "concluida", "recusada"];

export async function updateDemandStatusAction(formData: FormData): Promise<void> {
  const demandId = requiredString(formData, "demandId");
  const to = requiredString(formData, "to") as DemandStatus;
  if (!CONSOLE_TRANSITIONS.includes(to)) throw new Error(`Transição não permitida pelo console: ${to}.`);
  const resolution = optionalString(formData, "resolution");
  await withDemandContext(formData, "demand-update", async ({ store, isDemo, email }) => {
    const demands = await store.demands();
    const demand = demands.find((d) => d.id === demandId);
    if (!demand) throw new Error("Demanda não encontrada.");
    applyDemandTransition(demand, { to, by: email, resolution });
    await store.saveDemands(demands);
    await logAgentActivity(store, {
      actor: "console",
      kind: "demanda",
      summary:
        to === "em_andamento"
          ? `Demanda assumida: ${demand.title}`
          : `Demanda ${to === "concluida" ? "concluída" : "recusada"}: ${demand.title}`,
      refs: { demandId: demand.id },
    });
    logger.info("outbound.demand.update", { demandId, to, isDemo });
  });
}

/** Cancelar: só o que ainda está pendente (o autor desistiu antes do MORK assumir). */
export async function cancelDemandAction(formData: FormData): Promise<void> {
  const demandId = requiredString(formData, "demandId");
  await withDemandContext(formData, "demand-cancel", async ({ store, isDemo, email }) => {
    const demands = await store.demands();
    const demand = demands.find((d) => d.id === demandId);
    if (!demand) throw new Error("Demanda não encontrada.");
    applyDemandTransition(demand, { to: "cancelada", by: email });
    await store.saveDemands(demands);
    await logAgentActivity(store, {
      actor: "console",
      kind: "demanda",
      summary: `Demanda cancelada: ${demand.title}`,
      refs: { demandId: demand.id },
    });
    logger.info("outbound.demand.cancel", { demandId, isDemo });
  });
}
