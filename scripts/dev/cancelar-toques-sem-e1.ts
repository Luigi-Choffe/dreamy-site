// One-off (2026-10-15, regra nova do Luigi: toque no LinkedIn só DEPOIS do E1):
// cancela as tarefas de toque abertas de quem ainda NÃO teve o E1 processado pelo
// provedor (sent/delivered). Elas foram criadas pela regra antiga (um dia antes) e
// serão recriadas pela regra nova assim que o e-mail sair (tarefa cancelada não
// bloqueia a recriação). Idempotente.
// Uso: pnpm tsx scripts/dev/cancelar-toques-sem-e1.ts [--apply]

const E1_SAIU = new Set(["sent", "delivered"]);

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const apply = process.argv.includes("--apply");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  const { TOQUE_PREVIO_KIND } = await import("../../src/lib/outbound/toque-previo");

  await runExclusive("cancelar-toques-sem-e1", async () => {
    const store = openStore();
    const [tasks, sends] = await Promise.all([store.tasks(), store.sends()]);
    const comE1 = new Set(sends.filter((s) => s.stepId === "e1" && E1_SAIU.has(s.status)).map((s) => s.contactId));
    const abertas = tasks.filter((t) => t.kind === TOQUE_PREVIO_KIND && t.status === "aberta");
    const semE1 = abertas.filter((t) => t.contactId && !comE1.has(t.contactId));
    console.log(
      `toques abertos: ${abertas.length} · sem E1 ainda (cancelar): ${semE1.length} · com E1 (ficam): ${abertas.length - semE1.length}`,
    );
    if (!apply) {
      console.log("DRY-RUN: nada gravado. Repita com --apply.");
      return;
    }
    const now = new Date().toISOString();
    for (const t of semE1) {
      t.status = "cancelada";
      t.doneAt = now;
    }
    await store.saveTasks(tasks);
    console.log(`✓ ${semE1.length} tarefa(s) cancelada(s).`);
  });
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
