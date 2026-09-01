/** One-off: contagem de contatos ATIVOS por indústria (sem PII no stdout). */
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
import { openStore } from "../../src/lib/outbound/store";

async function main() {
  const store = openStore();
  const contacts = await store.contacts();
  const ativos = contacts.filter((c) => c.status === "active");
  const porIndustria = new Map<string, number>();
  for (const c of ativos) {
    const key = c.industria?.trim() || "(sem indústria)";
    porIndustria.set(key, (porIndustria.get(key) ?? 0) + 1);
  }
  console.log("ativos:", ativos.length, "· total:", contacts.length);
  for (const [industria, n] of [...porIndustria.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${industria}: ${n}`);
  }
  const comAbertura = ativos.filter((c) => typeof c.custom?.abertura === "string" && c.custom.abertura.length > 0);
  console.log("com abertura personalizada:", comAbertura.length);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
