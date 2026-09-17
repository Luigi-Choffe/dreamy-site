// One-off (2026-09-17): lista os bounces da logistica-estoque-receita para a
// investigação exigida antes de qualquer resume (dominio, passo, tipo).
import type { Contact } from "../../src/lib/outbound/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function main(): Promise<void> {
  const { openStore } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const [sends, contacts, supp] = await Promise.all([store.sends(), store.contacts(), store.suppressions()]);
  const byId = new Map<string, Contact>(contacts.map((c) => [c.id, c]));
  for (const s of sends.filter((x) => x.campaignSlug === "logistica-estoque-receita" && x.status === "bounced")) {
    const c = byId.get(s.contactId);
    const dominio = (c?.email ?? "").split("@")[1] ?? "?";
    console.log(
      `passo ${s.stepId} · ${c?.nome} ${c?.sobrenome ?? ""} · ${c?.empresa} · dominio ${dominio} · verif ${c?.verification}`,
    );
  }
  console.log("supressões:", supp.map((x) => `${x.reason} (${x.email.split("@")[1] ?? "?"})`).join(" · "));
}
main();
