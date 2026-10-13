// One-off (2026-10-13, decisão do Luigi): a onda 2 de CONTROLADORIA (sem Sobre no
// LinkedIn, "aguardando-onda-2-controladoria") e os 3 contatos cujo Sobre aponta
// outra empresa recebem a VARIANTE GENÉRICA da campanha (slug
// controladoria-painel-planilha), que não cita a empresa. Este script só move a
// cesta: reativa a onda 2 e tira os 3 da onda 1, todos com custom.cesta
// "controladoria onda-2". A inscrição é outro passo. Falha alto em match ambíguo.
// Uso: pnpm tsx scripts/dev/apply-onda2-controladoria.ts [--apply]

const DUVIDOSOS: Array<{ nome: string; empresaChave: string }> = [
  { nome: "caio", empresaChave: "olos" },
  { nome: "yasmin", empresaChave: "pibernat" },
  { nome: "jean", empresaChave: "nutramerica" },
];

function semAcento(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const apply = process.argv.includes("--apply");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");

  await runExclusive("apply-onda2-controladoria", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const lote = contacts.filter((c) => c.industria === "controladoria");
    const onda2 = lote.filter((c) => c.status === "excluded" && c.excludedReason === "aguardando-onda-2-controladoria");
    const onda1 = lote.filter((c) => c.status === "active" && c.custom.cesta === "controladoria onda-1");
    const duvidosos = DUVIDOSOS.map((d) => {
      const m = onda1.filter(
        (c) => semAcento(c.nome.trim()) === d.nome && semAcento(c.empresa ?? "").includes(d.empresaChave),
      );
      if (m.length !== 1)
        throw new Error(`duvidoso "${d.nome}" (${d.empresaChave}): ${m.length} match(es) — abortando`);
      return m[0]!;
    });
    console.log(`onda 2 (sem Sobre): ${onda2.length} · duvidosos saindo da onda 1: ${duvidosos.length}`);
    for (const c of duvidosos) console.log(`  ${c.nome} · ${c.empresa} · ${c.cargo}`);
    if (!apply) {
      console.log("DRY-RUN: nada gravado. Repita com --apply.");
      return;
    }
    for (const c of [...onda2, ...duvidosos]) {
      c.status = "active";
      delete c.excludedReason;
      c.custom.cesta = "controladoria onda-2";
    }
    await store.saveContacts(contacts);
    console.log(`✓ ${onda2.length + duvidosos.length} contato(s) na onda 2 (variante genérica), ativos e unverified.`);
  });
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
