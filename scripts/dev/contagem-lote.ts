// One-off (2026-10-13): confere em que store um lote caiu (Neon vs arquivo) e conta.
// Uso: pnpm tsx scripts/dev/contagem-lote.ts <importBatchId>
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
async function main(): Promise<void> {
  const id = process.argv[2] ?? "";
  const { openStore, databaseUrl } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const contacts = await store.contacts();
  const lote = contacts.filter((c) => c.importBatchId === id);
  console.log(
    `store: ${databaseUrl() ? "postgres (Neon)" : "arquivo local"} · contatos total ${contacts.length} · no lote ${lote.length}`,
  );
  const semIndustria = lote.filter((c) => !c.industria).length;
  const comSobre = lote.filter((c) => String(c.custom?.summary ?? "").trim()).length;
  console.log(
    `lote: sem indústria ${semIndustria} · com Sobre ${comSobre} · chaves custom: ${Object.keys(lote[0]?.custom ?? {}).join(", ")}`,
  );
}
main();
export {};
