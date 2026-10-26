// Relatório (só leitura): envios por dia útil nas últimas N datas, por campanha e status.
// Uso: pnpm tsx scripts/dev/envios-por-dia.ts [dias=14]
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
async function main(): Promise<void> {
  const dias = Number(process.argv[2] ?? 14);
  const { openStore } = await import("../../src/lib/outbound/store");
  const sends = await openStore().sends();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const porDia = new Map<string, Map<string, number>>();
  for (const s of sends) {
    const dia = (s.sentAt ?? s.scheduledAt ?? "").slice(0, 10);
    if (!dia || dia < desde) continue;
    const chave = `${s.campaignSlug.replace("controladoria-", "ctrl:").replace("logistica-estoque-receita", "log")} ${s.stepId} ${s.status}`;
    const m = porDia.get(dia) ?? new Map<string, number>();
    m.set(chave, (m.get(chave) ?? 0) + 1);
    porDia.set(dia, m);
  }
  for (const [dia, m] of [...porDia.entries()].sort()) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    console.log(`${dia}: ${total} · ${[...m.entries()].sort().map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  }
}
main();
export {};
