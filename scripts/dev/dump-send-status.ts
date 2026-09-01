/** One-off: status agregado dos sends reais (sem PII no stdout). */
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
import { openStore } from "../../src/lib/outbound/store";

async function main() {
  const store = openStore();
  const sends = await store.sends();
  const porStatus = new Map<string, number>();
  for (const s of sends) porStatus.set(s.status, (porStatus.get(s.status) ?? 0) + 1);
  console.log("total:", sends.length, "por status:", Object.fromEntries(porStatus));
  const ordenados = [...sends].sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const ultimo = ordenados.at(-1);
  if (ultimo) {
    console.log("último:", {
      step: ultimo.stepId,
      status: ultimo.status,
      scheduledAt: ultimo.scheduledAt,
      sentAt: ultimo.sentAt,
    });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
