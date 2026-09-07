// Diagnóstico: por que cada contato está "excluded" (contagem por motivo e cargo).
// Uso: pnpm tsx scripts/dev/dump-excluidos.ts  (leitura, sem lock)

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { openStore } = await import("../../src/lib/outbound/store");
  const contacts = await openStore().contacts();
  const excluidos = contacts.filter((c) => c.status === "excluded");
  const porMotivo = new Map<string, number>();
  const porCargo = new Map<string, number>();
  for (const c of excluidos) {
    const motivo = c.excludedReason ?? "sem motivo";
    porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
    if (motivo === "cargo-fora-icp") {
      const cargo = (c.cargo ?? "sem cargo").toLowerCase();
      porCargo.set(cargo, (porCargo.get(cargo) ?? 0) + 1);
    }
  }
  console.log(`excluídos: ${excluidos.length} de ${contacts.length}`);
  console.log("por motivo:");
  for (const [motivo, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`  ${motivo}: ${n}`);
  console.log("cargos (dos fora do ICP):");
  for (const [cargo, n] of [...porCargo].sort((a, b) => b[1] - a[1])) console.log(`  ${cargo}: ${n}`);
}

void main();

export {};
