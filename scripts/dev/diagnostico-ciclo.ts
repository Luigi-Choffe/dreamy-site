// Diagnóstico read-only do estado da operação (sem PII: nomes/empresas, nunca e-mail).
// Toques prévios (tarefas e resultados), previsão dos próximos dias por campanha/passo,
// inscrições ativas, campanhas pausadas e contatos com bounce.
// Uso: pnpm tsx scripts/dev/diagnostico-ciclo.ts

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { openStore } = await import("../../src/lib/outbound/store");
  const { forecastCadence } = await import("../../src/lib/outbound/agenda-core");
  const { getOutboundEnv, sendDateKey } = await import("../../src/lib/outbound/config");
  const { campaigns } = await import("../../src/content/outbound");

  const s = openStore();
  const [contacts, enrollments, sends, suppressions, runtimes, state, tasks] = await Promise.all([
    s.contacts(),
    s.enrollments(),
    s.sends(),
    s.suppressions(),
    s.campaignRuntimes(),
    s.state(),
    s.tasks(),
  ]);
  const env = getOutboundEnv();
  const now = new Date();
  const byId = new Map(contacts.map((c) => [c.id, c]));
  console.log(`agora (local): ${sendDateKey(now, env.utcOffset)} · cap ${state.armed ? "armado" : "desarmado"}`);

  const toques = tasks.filter((t) => t.kind === "toque-previo");
  const porStatus: Record<string, number> = {};
  for (const t of toques) porStatus[t.status] = (porStatus[t.status] ?? 0) + 1;
  const resultados: Record<string, number> = {};
  for (const c of contacts) {
    const v = c.custom.toque_previo;
    if (v) {
      const k = v.split(" ")[0] as string;
      resultados[k] = (resultados[k] ?? 0) + 1;
    }
  }
  console.log("TOQUES · tarefas por status:", porStatus, "· resultado nos contatos:", resultados);

  console.log("RUNTIMES pausados:");
  for (const r of runtimes) {
    if (r.pausedAt) console.log(`  ${r.slug}: pausada em ${r.pausedAt} · motivo ${r.pausedReason ?? "?"}`);
  }

  console.log("BOUNCES:");
  for (const snd of sends) {
    if (snd.status !== "bounced") continue;
    const c = byId.get(snd.contactId);
    console.log(
      `  ${snd.campaignSlug}/${snd.stepId} · ${c?.nome ?? "?"} ${c?.sobrenome ?? ""} · ${c?.empresa ?? "?"} · domínio ${c?.email.split("@")[1] ?? "?"}`,
    );
  }

  const ativos: Record<string, number> = {};
  for (const e of enrollments) {
    if (e.status !== "active") continue;
    const k = `${e.campaignSlug} · próximo passo e${e.nextStep + 1}`;
    ativos[k] = (ativos[k] ?? 0) + 1;
  }
  console.log("INSCRIÇÕES ativas:", ativos);

  const f = forecastCadence(
    { contacts, enrollments, sends, suppressions, campaignDefs: campaigns, runtimes, state, env, now },
    6,
  );
  console.log(`PREVISÃO (6 dias) · bloqueio: ${f.blockedReason ?? "-"} · dias retornados: ${f.days.length}`);
  for (const d of f.days) {
    const g: Record<string, number> = {};
    for (const i of d.items) g[`${i.campaignSlug}/${i.stepId}`] = (g[`${i.campaignSlug}/${i.stepId}`] ?? 0) + 1;
    console.log(`  ${d.dateKey}: ${d.items.length} ${JSON.stringify(g)}`);
  }
}

void main();

export {};
