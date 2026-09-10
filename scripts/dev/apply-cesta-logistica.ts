// One-off (2026-09-10): aplica a cesta da auditoria do GARIMPO ao lote de logística.
// Lê o JSON de dump-auditoria-logistica.ts --out e, por contato (casado por nome +
// domínio do e-mail + grafia da empresa):
//   onda 1                      → segue active, custom.cesta = "logistica onda-1"
//   onda 2 (reserva)            → excluded, excludedReason "reserva-onda-2-logistica"
//   onda 0 (fora do ICP/cargo)  → excluded, excludedReason "fora-icp-logistica"
//   Polar / Zenatur (ângulo)    → excluded, excludedReason "angulo-diferente-logistica"
// Aprovado pelo Luigi em 10/09 ("pode ser como você sugeriu"). Falha alto em match ambíguo.
// Uso: pnpm tsx scripts/dev/apply-cesta-logistica.ts <cesta.json> [--apply]

import { readFileSync } from "node:fs";

interface Linha {
  empresa: string;
  grafia: string;
  nome: string;
  dom: string;
  decisao: { classe: string; onda: 0 | 1 | 2; flag?: string };
}

const ANGULO_DIFERENTE = /^(grupo polar|polar tecnica|zenatur)/i;

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("uso: apply-cesta-logistica.ts <cesta.json> [--apply]");
  const apply = flag === "--apply";
  const linhas = JSON.parse(readFileSync(file, "utf8")) as Linha[];
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");

  await runExclusive("apply-cesta-logistica", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const logistica = contacts.filter((c) => c.industria === "logística");
    const tally = { onda1: 0, reserva: 0, fora: 0, angulo: 0 };
    const vistos = new Set<string>();

    for (const l of linhas) {
      const nome = l.nome.trim().toLowerCase();
      const matches = logistica.filter((c) => {
        const nomeCompleto = `${c.nome} ${c.sobrenome ?? ""}`.trim().toLowerCase();
        const dom = c.email.split("@")[1]?.toLowerCase();
        return nomeCompleto === nome && dom === l.dom.toLowerCase() && (c.empresa ?? "") === l.grafia;
      });
      if (matches.length !== 1) throw new Error(`"${l.nome}" (${l.grafia}): ${matches.length} match(es) — abortando`);
      const c = matches[0];
      if (vistos.has(c.id)) throw new Error(`contato repetido na cesta: ${l.nome}`);
      vistos.add(c.id);

      if (ANGULO_DIFERENTE.test(l.empresa)) {
        c.status = "excluded";
        c.excludedReason = "angulo-diferente-logistica";
        c.custom.cesta = "logistica angulo-diferente (onda futura)";
        tally.angulo++;
      } else if (l.decisao.onda === 1) {
        c.status = "active";
        c.custom.cesta = `logistica onda-1 classe-${l.decisao.classe}${l.decisao.flag ? " ⚠" : ""}`;
        tally.onda1++;
      } else if (l.decisao.onda === 2) {
        c.status = "excluded";
        c.excludedReason = "reserva-onda-2-logistica";
        c.custom.cesta = `logistica reserva classe-${l.decisao.classe}`;
        tally.reserva++;
      } else {
        c.status = "excluded";
        c.excludedReason = "fora-icp-logistica";
        c.custom.cesta = "logistica fora";
        tally.fora++;
      }
    }
    const semDecisao = logistica.filter((c) => !vistos.has(c.id)).length;
    console.log(
      `cesta: onda1 ${tally.onda1} · reserva ${tally.reserva} · fora ${tally.fora} · ângulo ${tally.angulo} · sem linha na auditoria ${semDecisao}`,
    );
    if (!apply) {
      console.log("(dry-run: nada gravado; use --apply)");
      return;
    }
    await store.saveContacts(contacts);
    console.log("✓ cesta aplicada.");
  });
}

void main();

export {};
