// One-off (2026-10-14): quem está no plano previsto do PRÓXIMO dia útil (nomes/empresas,
// sem e-mail), pela mesma previsão da Agenda. Uso: pnpm tsx scripts/dev/previsao-nomes.ts [filtro]
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
async function main(): Promise<void> {
  const filtro = (process.argv[2] ?? "").toLowerCase();
  const { openStore } = await import("../../src/lib/outbound/store");
  const { getOutboundEnv } = await import("../../src/lib/outbound/config");
  const { forecastCadence } = await import("../../src/lib/outbound/agenda-core");
  const { campaigns } = await import("../../src/content/outbound");
  const store = openStore();
  const [contacts, enrollments, sends, suppressions, runtimes, state] = await Promise.all([
    store.contacts(), store.enrollments(), store.sends(), store.suppressions(), store.campaignRuntimes(), store.state(),
  ]);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const r = forecastCadence({ contacts, enrollments, sends, suppressions, campaignDefs: campaigns, runtimes, state, env: getOutboundEnv() }, 4);
  for (const d of r.days) {
    const nomes = d.items.map((it) => { const c = byId.get(it.contactId); return `${c?.nome} (${c?.empresa})`; });
    const hit = nomes.filter((n) => n.toLowerCase().includes(filtro));
    console.log(`${d.dateKey}: ${d.items.length} · ${filtro ? `casam "${filtro}": ${hit.join("; ") || "nenhum"}` : nomes.slice(0, 5).join("; ")}`);
  }
}
main();
export {};
