import { newId, type OutboundStore } from "./store";
import type { AgentActivity } from "./types";

/**
 * Prestação de contas do MORK e do console (página /interno/outbound/mork).
 * Insert simples e best-effort: o resumo NUNCA leva e-mail de contato (PII) —
 * vínculos vão em `refs` por id.
 */
export async function logAgentActivity(
  store: OutboundStore,
  activity: Omit<AgentActivity, "id" | "at"> & { at?: string },
): Promise<void> {
  const { at, ...rest } = activity;
  const rows = await store.agentActivities();
  rows.push({ id: newId(), ...rest, at: at ?? new Date().toISOString() });
  await store.saveAgentActivities(rows);
}
