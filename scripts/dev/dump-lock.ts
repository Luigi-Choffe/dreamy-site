// Diagnóstico: quem segura o lock "outbound" no banco (e até quando).
// Uso: pnpm tsx scripts/dev/dump-lock.ts
async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { getSqlClient } = await import("../../src/lib/outbound/store");
  const rows = await getSqlClient().query<{ name: string; holder: string; expires_at: string; agora: string }>(
    "SELECT name, holder, expires_at, now() AS agora FROM outbound_locks",
    [],
  );
  console.log(rows.length === 0 ? "nenhum lock no banco" : JSON.stringify(rows, null, 2));
}

void main();

export {};
