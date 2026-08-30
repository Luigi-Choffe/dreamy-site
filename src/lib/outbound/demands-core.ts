import { randomUUID } from "node:crypto";
import type { Demand, DemandKind, DemandStatus } from "./types";

/**
 * Fila de demandas do MORK (PRD §29): o time pede pelo console, o MORK consome
 * pela CLI (`outbound:demandas`) no mesmo store. Núcleo puro e testável; quem
 * persiste são as actions e a CLI.
 *
 * Transições: pendente → em_andamento | recusada | cancelada;
 *             em_andamento → concluida | recusada. Estados finais não mudam.
 * `resolution` é obrigatória em concluida/recusada (prestação de contas).
 */

const TRANSITIONS: Record<DemandStatus, DemandStatus[]> = {
  pendente: ["em_andamento", "recusada", "cancelada"],
  em_andamento: ["concluida", "recusada"],
  concluida: [],
  recusada: [],
  cancelada: [],
};

export function canTransition(from: DemandStatus, to: DemandStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export interface DemandTransitionInput {
  to: DemandStatus;
  /** Quem executa: "mork", e-mail da sessão. */
  by: string;
  /** Obrigatória em concluida/recusada. */
  resolution?: string;
  now?: Date;
}

/** Valida e MUTA a demanda (chame com a cópia da coleção que vai salvar). */
export function applyDemandTransition(demand: Demand, input: DemandTransitionInput): void {
  if (!canTransition(demand.status, input.to)) {
    throw new Error(`Transição inválida: "${demand.status}" não vai para "${input.to}".`);
  }
  const resolution = input.resolution?.trim();
  if ((input.to === "concluida" || input.to === "recusada") && !resolution) {
    throw new Error(`"${input.to}" exige uma resolução (o que foi feito, ou por que não).`);
  }
  const at = (input.now ?? new Date()).toISOString();
  if (input.to === "em_andamento") {
    demand.claimedBy = input.by;
    demand.claimedAt = at;
  }
  if (input.to === "concluida" || input.to === "recusada" || input.to === "cancelada") {
    demand.doneAt = at;
  }
  if (resolution) demand.resolution = resolution;
  demand.status = input.to;
}

export const DEMAND_KINDS: DemandKind[] = ["copy", "leads", "analise", "resposta", "operacao", "outra"];

export interface BuildDemandInput {
  title: string;
  details?: string;
  kind: DemandKind;
  priority?: "normal" | "alta";
  createdBy: string;
  campaignSlug?: string;
  contactId?: string;
  now?: Date;
}

export function buildDemand(input: BuildDemandInput): Demand {
  const title = input.title.trim();
  if (!title) throw new Error("Demanda sem título.");
  if (!DEMAND_KINDS.includes(input.kind)) throw new Error(`Tipo de demanda inválido: "${input.kind}".`);
  return {
    id: randomUUID(),
    title,
    details: input.details?.trim() || undefined,
    kind: input.kind,
    status: "pendente",
    priority: input.priority ?? "normal",
    createdBy: input.createdBy,
    createdAt: (input.now ?? new Date()).toISOString(),
    campaignSlug: input.campaignSlug,
    contactId: input.contactId,
  };
}
