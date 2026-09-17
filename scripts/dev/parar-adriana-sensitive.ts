// One-off (2026-09-17): para manualmente o enrollment da Adriana (Sensitive
// Transportes) na logistica-estoque-receita. Motivo: o colega Emanuel respondeu
// interessado em 16/09 e o Luigi vai abordar a Adriana com um e-mail pessoal
// citando a conversa em andamento, fora da automacao. Confere antes que nao ha
// envio agendado no Resend para ela (E2 so seria agendado no ciclo de 19/09).
// Uso: pnpm tsx scripts/dev/parar-adriana-sensitive.ts [--dry-run]

const ENROLLMENT_ID = "f4eb2764-6bab-4d1a-aed0-ca89f4731929";
const CONTACT_ID = "f670f920-e8b5-4e59-962e-14eedf45a89a";

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const dryRun = process.argv.includes("--dry-run");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");

  await runExclusive("parar-adriana-sensitive", async () => {
    const store = openStore();
    const enrollments = await store.enrollments();
    const e = enrollments.find((x) => x.id === ENROLLMENT_ID);
    if (!e) throw new Error("enrollment não encontrado — nada gravado");
    if (e.contactId !== CONTACT_ID) throw new Error("enrollment não é da Adriana — nada gravado");
    if (e.status !== "active") {
      console.log(`Já está "${e.status}" (stopReason: ${e.stopReason ?? "?"}) — nada a fazer.`);
      return;
    }
    const sends = await store.sends();
    const agendados = sends.filter((s) => s.contactId === CONTACT_ID && s.status === "scheduled");
    console.log(`envios agendados no Resend para a Adriana: ${agendados.length}`);
    if (agendados.length > 0) {
      throw new Error("há envio agendado — cancelar no Resend antes; nada gravado");
    }
    if (dryRun) {
      console.log(`DRY-RUN — pararia o enrollment (status active, nextStep ${e.nextStep}).`);
      return;
    }
    e.status = "stopped";
    e.stopReason = "manual";
    await store.saveEnrollments(enrollments);
    console.log("✓ Enrollment da Adriana parado (manual). E2 automático não sai mais.");
  });
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
