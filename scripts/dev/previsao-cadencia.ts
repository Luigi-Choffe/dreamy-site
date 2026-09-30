// One-off (2026-09-29): previsão da cadência dos próximos dias úteis pelo MESMO
// motor da Agenda (forecastCadence roda o computePlan dia a dia). Só leitura.
// Uso: pnpm tsx scripts/dev/previsao-cadencia.ts [dias=7]

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function main(): Promise<void> {
  const dias = Number(process.argv[2] ?? 7);
  const { openStore } = await import("../../src/lib/outbound/store");
  const { getOutboundEnv } = await import("../../src/lib/outbound/config");
  const { forecastCadence } = await import("../../src/lib/outbound/agenda-core");
  const { campaigns } = await import("../../src/content/outbound");
  const store = openStore();
  const [contacts, enrollments, sends, suppressions, runtimes, state] = await Promise.all([
    store.contacts(),
    store.enrollments(),
    store.sends(),
    store.suppressions(),
    store.campaignRuntimes(),
    store.state(),
  ]);
  const r = forecastCadence(
    { contacts, enrollments, sends, suppressions, campaignDefs: campaigns, runtimes, state, env: getOutboundEnv() },
    dias,
  );
  if (r.blockedReason) console.log(`previsão bloqueada: ${r.blockedReason}`);
  for (const d of r.days) {
    const porPasso = new Map<string, number>();
    for (const it of d.items) {
      const chave = `${it.campaignSlug} ${it.stepId}`;
      porPasso.set(chave, (porPasso.get(chave) ?? 0) + 1);
    }
    const detalhe = [...porPasso.entries()].map(([k, n]) => `${k}=${n}`).join(" · ") || "nada";
    console.log(`${d.dateKey}: ${d.items.length} envio(s) · ${detalhe}`);
  }
}
main();

export {};
