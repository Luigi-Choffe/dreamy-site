// One-off (2026-09-10): o export do Clay de logística veio sem coluna de indústria;
// carimba industria = "logística" em todo contato dos lotes cuja origem contém
// "logistica" e que ainda está sem indústria. Idempotente.
// Uso: pnpm tsx scripts/dev/apply-industria-logistica.ts [--dry-run]

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const dryRun = process.argv.includes("--dry-run");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  await runExclusive("apply-industria-logistica", async () => {
    const store = openStore();
    const [contacts, batches] = await Promise.all([store.contacts(), store.imports()]);
    const lotes = new Set(batches.filter((b) => b.origin.toLowerCase().includes("logistica")).map((b) => b.id));
    let n = 0;
    for (const c of contacts) {
      if (!lotes.has(c.importBatchId)) continue;
      if ((c.industria ?? "").trim() !== "") continue;
      c.industria = "logística";
      n++;
    }
    if (dryRun) {
      console.log(`DRY-RUN: carimbaria ${n} contato(s) de ${lotes.size} lote(s).`);
      return;
    }
    await store.saveContacts(contacts);
    console.log(`✓ ${n} contato(s) carimbados com industria "logística" (${lotes.size} lotes).`);
  });
}

void main();

export {};
