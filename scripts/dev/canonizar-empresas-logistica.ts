// Correção (2026-09-10): o Clay trouxe a MESMA empresa com grafias diferentes
// ("AGS HOLDING" / "AGS Logistics" / "AGS Global Logistics", "Pierserv" /
// "PierServ Logística Promocional", "PELOG Transportes" / "Pelog Soluções"…).
// Grafia diferente = empresa diferente para normalizeEmpresa, o que quebra a
// frase dos colegas (falsos "solo") e o agrupamento por empresa no plano.
// Aplica a grafia CANÔNICA da auditoria do GARIMPO (campo `empresa` do JSON de
// dump-auditoria-logistica.ts --out; `grafia` é o valor cru) em contact.empresa.
// Uso: pnpm tsx scripts/dev/canonizar-empresas-logistica.ts <cesta.json> [--apply]

import { readFileSync } from "node:fs";

interface Linha {
  empresa: string;
  grafia: string;
  nome: string;
  dom: string;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("uso: canonizar-empresas-logistica.ts <cesta.json> [--apply]");
  const apply = flag === "--apply";
  const linhas = (JSON.parse(readFileSync(file, "utf8")) as Linha[]).filter((l) => l.empresa !== l.grafia);
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");

  await runExclusive("canonizar-empresas-logistica", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const logistica = contacts.filter((c) => c.industria === "logística");
    const mudancas: string[] = [];
    for (const l of linhas) {
      const nome = l.nome.trim().toLowerCase();
      const matches = logistica.filter((c) => {
        const nomeCompleto = `${c.nome} ${c.sobrenome ?? ""}`.trim().toLowerCase();
        return (
          nomeCompleto === nome &&
          c.email.split("@")[1]?.toLowerCase() === l.dom.toLowerCase() &&
          c.empresa === l.grafia
        );
      });
      if (matches.length !== 1) throw new Error(`"${l.nome}" (${l.grafia}): ${matches.length} match(es) — abortando`);
      const c = matches[0];
      c.custom.empresa_grafia_clay = l.grafia;
      c.empresa = l.empresa;
      mudancas.push(`${l.grafia} → ${l.empresa} (${c.nome})`);
    }
    console.log(`grafias a canonizar: ${mudancas.length}`);
    for (const m of mudancas) console.log(`  ${m}`);
    if (!apply) {
      console.log("(dry-run: nada gravado)");
      return;
    }
    await store.saveContacts(contacts);
    console.log("✓ empresas canonizadas (grafia original preservada em custom.empresa_grafia_clay).");
  });
}

void main();

export {};
