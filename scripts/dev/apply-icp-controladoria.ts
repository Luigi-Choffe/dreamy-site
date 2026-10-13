// One-off (2026-10-13): segunda passada de ICP na onda 1 de CONTROLADORIA, a partir
// dos alertas dos redatores (VERBO) ao ler o perfil de cada pessoa. O filtro por
// cargo deixou passar "controllers" que não são de controladoria financeira:
// manutenção de aeronave, acesso, frota, documentos de RH, projetos, orçamentistas
// de obra, encarregados de contas, estagiários e um aposentado. Casamento por nome +
// trecho do nome da empresa; falha alto em 0 ou 2+ matches. Idempotente.
// Uso: pnpm tsx scripts/dev/apply-icp-controladoria.ts [--apply]

interface Corte {
  nome: string;
  empresaChave: string;
  motivo: string;
}

const CORTES: Corte[] = [
  { nome: "marcelo", empresaChave: "helibras", motivo: "maintenance technical controller (manutenção de aeronave)" },
  { nome: "raissa", empresaChave: "let", motivo: "controladora de frota (operacional)" },
  { nome: "tácito", empresaChave: "modern logistics", motivo: "moc controller (manutenção de aeronave)" },
  { nome: "tatiane", empresaChave: "ods", motivo: "document controller de RH" },
  { nome: "giovana", empresaChave: "baroneza", motivo: "controladora de acesso" },
  { nome: "maria", empresaChave: "myralis", motivo: "estagiária de controladoria" },
  { nome: "luiz", empresaChave: "confab", motivo: "headline aposentado" },
  { nome: "igor", empresaChave: "dreams", motivo: "desenvolvedor web, não controller" },
  { nome: "gabriel", empresaChave: "exto", motivo: "estagiário de engenharia (orçamento de obra)" },
  { nome: "mino", empresaChave: "combustol", motivo: "projects controller (gestão de projetos)" },
  { nome: "carla", empresaChave: "tuf", motivo: "encarregada financeira (não decide sistema)" },
  { nome: "mariana", empresaChave: "vetminas", motivo: "encarregada financeira (não decide sistema)" },
  { nome: "wilson", empresaChave: "heleno", motivo: "encarregado financeiro (contas a pagar/receber)" },
  { nome: "mylena", empresaChave: "hoga", motivo: "orçamentista de obra (engenharia)" },
  { nome: "camila", empresaChave: "hersa", motivo: "orçamentista de obra (engenharia)" },
  { nome: "marcos", empresaChave: "unifort", motivo: "júnior, 10 meses na função, ex-conferente" },
];

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const apply = process.argv.includes("--apply");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");

  await runExclusive("apply-icp-controladoria", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const onda1 = contacts.filter(
      (c) => c.industria === "controladoria" && c.status === "active" && c.custom.cesta === "controladoria onda-1",
    );
    const alvo: Array<{ c: (typeof contacts)[number]; motivo: string }> = [];
    for (const corte of CORTES) {
      const matches = onda1.filter(
        (c) =>
          c.nome.trim().toLowerCase() === corte.nome &&
          (c.empresa ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .includes(corte.empresaChave.normalize("NFD").replace(/[̀-ͯ]/g, "")),
      );
      if (matches.length !== 1) {
        throw new Error(
          `corte "${corte.nome}" (${corte.empresaChave}): ${matches.length} match(es) na onda 1 — abortando, nada gravado`,
        );
      }
      alvo.push({ c: matches[0]!, motivo: corte.motivo });
    }
    console.log(
      `onda 1 antes: ${onda1.length} · cortes: ${alvo.length} · onda 1 depois: ${onda1.length - alvo.length}`,
    );
    for (const { c, motivo } of alvo) console.log(`  ${c.nome} · ${c.empresa} · ${c.cargo}: ${motivo}`);
    if (!apply) {
      console.log("DRY-RUN: nada gravado. Repita com --apply.");
      return;
    }
    for (const { c, motivo } of alvo) {
      c.status = "excluded";
      c.excludedReason = "fora-icp-controladoria";
      c.custom.cesta = "controladoria fora-icp (2a passada)";
      c.custom.icp_motivo = motivo;
    }
    await store.saveContacts(contacts);
    console.log(`✓ ${alvo.length} contato(s) movidos para fora do ICP.`);
  });
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
