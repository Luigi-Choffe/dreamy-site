/** Simula o plano de um dia útil futuro (read-only) — mostra o que a automação fará. */
import { campaigns } from "../../src/content/outbound";
import { getOutboundEnv } from "../../src/lib/outbound/config";
import { computePlan } from "../../src/lib/outbound/engine";
import { openStore } from "../../src/lib/outbound/store";
try { process.loadEnvFile(".env.local"); } catch { /* shell */ }
async function main() {
  const store = openStore();
  const [contacts, enrollments, sends, suppressions, runtimes, state] = await Promise.all([
    store.contacts(), store.enrollments(), store.sends(), store.suppressions(), store.campaignRuntimes(), store.state(),
  ]);
  // segunda-feira 2026-08-31, 09:05 em São Paulo (12:05Z)
  const monday = new Date("2026-08-31T12:05:00Z");
  const plan = computePlan({
    contacts, enrollments, sends, suppressions, campaignDefs: campaigns, runtimes, state,
    env: getOutboundEnv(), now: monday,
  });
  const byId = new Map(contacts.map((c) => [c.id, c]));
  console.log(plan.blockedReason ? `BLOQUEADO: ${plan.blockedReason}` : `planejados: ${plan.items.length} · cap ${plan.capInfo.cap}`);
  for (const it of plan.items) {
    const c = byId.get(it.contactId)!;
    console.log(`  ${it.scheduledAt.slice(11, 16)}  ${it.stepId}  ${c.nome} · ${c.empresa}`);
  }
  const fica = plan.skipped.filter((s) => s.reason.includes("fora do cap"));
  if (fica.length) console.log(`  (+${fica.length} ficam para terça — cap da rampa)`);
}
main();
