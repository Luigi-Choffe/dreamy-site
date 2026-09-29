// One-off (2026-09-29): confere se os envios que o Resend responde 404 são os mais
// antigos (retenção do provedor). Lê ids do auto.log; não grava nada.
import fs from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function main(): Promise<void> {
  const log = fs.readFileSync(".outbound/auto.log", "utf8").split("\n");
  const ultimo = log.filter((l) => l.includes("consulta_falhou")).slice(-15);
  const ids = new Set(ultimo.map((l) => JSON.parse(l).sendId as string));
  const { openStore } = await import("../../src/lib/outbound/store");
  const sends = await openStore().sends();
  const falhos = sends.filter((s) => ids.has(s.id));
  for (const s of falhos) console.log(`${s.sentAt ?? s.scheduledAt} · ${s.campaignSlug} · ${s.stepId} · ${s.status}`);
  const maisAntigoOk = sends
    .filter((s) => !ids.has(s.id) && s.resendEmailId)
    .map((s) => s.sentAt ?? s.scheduledAt)
    .sort()[0];
  console.log(`envio mais antigo que ainda responde: ${maisAntigoOk}`);
}
main();
