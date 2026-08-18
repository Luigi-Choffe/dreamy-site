import fs from "node:fs/promises";
import path from "node:path";
import type { LeadRecord } from "./types";

/**
 * LeadStore: persistência opcional. Em V1 não há banco (non-goal). Em desenvolvimento,
 * grava JSONL em `.leads/` (gitignored) para testar o fluxo ponta a ponta sem integrações.
 * Em produção, retorna false (não persiste) — a entrega é responsabilidade do CRM/e-mail.
 */
export interface LeadStore {
  readonly name: string;
  /** retorna true se persistiu */
  save(lead: LeadRecord): Promise<boolean>;
}

export function createDevFileStore(dir = path.join(process.cwd(), ".leads")): LeadStore {
  return {
    name: "dev-file",
    async save(lead) {
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
      await fs.appendFile(file, JSON.stringify(lead) + "\n", "utf8");
      return true;
    },
  };
}

export function createNoopStore(): LeadStore {
  return { name: "none", save: async () => false };
}

export function createLeadStore(): LeadStore {
  if (process.env.NODE_ENV === "development" && process.env.LEADS_DEV_STORE !== "false") return createDevFileStore();
  return createNoopStore();
}
