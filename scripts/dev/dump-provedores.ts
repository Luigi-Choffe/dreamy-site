// Diagnóstico: provedor de e-mail (MX) dos destinatários com enrollment ativo —
// Google e Microsoft têm filtros de spam bem diferentes para remetente novo.
// Read-only; sem e-mail de contato no stdout (só domínio e contagem).
// Uso: pnpm tsx scripts/dev/dump-provedores.ts

import { promises as dns } from "node:dns";

function classifica(mx: string): string {
  const h = mx.toLowerCase();
  if (h.includes("google")) return "google";
  if (h.includes("outlook") || h.includes("microsoft")) return "microsoft";
  if (h.includes("proofpoint") || h.includes("pphosted")) return "proofpoint";
  if (h.includes("barracuda")) return "barracuda";
  if (h.includes("locaweb")) return "locaweb";
  if (h.includes("uol")) return "uolhost";
  if (h.includes("hostinger")) return "hostinger";
  if (h.includes("secureserver")) return "godaddy";
  if (h.includes("zoho")) return "zoho";
  return "outro";
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { openStore } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const [contacts, enrollments] = await Promise.all([store.contacts(), store.enrollments()]);
  const ids = new Set(
    enrollments.filter((e) => e.status === "active" || e.status === "finished").map((e) => e.contactId),
  );
  const dominios = new Map<string, number>();
  for (const c of contacts) {
    if (!ids.has(c.id)) continue;
    const dominio = c.email.split("@")[1]?.toLowerCase();
    if (dominio) dominios.set(dominio, (dominios.get(dominio) ?? 0) + 1);
  }
  const porProvedor = new Map<string, number>();
  for (const [dominio, n] of dominios) {
    let provedor = "sem-mx";
    try {
      const mx = await dns.resolveMx(dominio);
      if (mx.length > 0) provedor = classifica(mx.sort((a, b) => a.priority - b.priority)[0].exchange);
    } catch {
      provedor = "erro-dns";
    }
    porProvedor.set(provedor, (porProvedor.get(provedor) ?? 0) + n);
  }
  console.log(
    `destinatários com sequência: ${[...dominios.values()].reduce((a, b) => a + b, 0)} em ${dominios.size} domínios`,
  );
  for (const [p, n] of [...porProvedor].sort((a, b) => b[1] - a[1])) console.log(`  ${p}: ${n}`);
}

void main();

export {};
