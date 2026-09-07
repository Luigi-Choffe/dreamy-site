// One-off (2026-09-07): reativa os 20 contatos recomendados pela auditoria do
// GARIMPO para a campanha "validacao-indicacao" (gestão intermediária pedindo
// indicação do decisor). Mantém excludedReason como trilha de auditoria e marca
// a onda em custom.reativacao. Falha alto se um alvo casar 0 ou 2+ contatos.
// Uso: pnpm tsx scripts/dev/reativar-indicacao.ts [--dry-run]

interface Alvo {
  nome: string;
  empresaChave: string;
  onda: "onda-1" | "onda-2";
}

const ALVOS: Alvo[] = [
  // Onda 1 — empresas sem decisor em sequência ativa.
  { nome: "thales thomazi", empresaChave: "geomembrana", onda: "onda-1" },
  { nome: "emerson carregari", empresaChave: "formeq", onda: "onda-1" },
  { nome: "ricardo grinberg", empresaChave: "certo", onda: "onda-1" },
  { nome: "sidnei caetano", empresaChave: "newset", onda: "onda-1" },
  { nome: "andré dos santos", empresaChave: "sulmetais", onda: "onda-1" },
  { nome: "renato vieira", empresaChave: "inside", onda: "onda-1" },
  // Onda 2 — entram quando o enrollment do decisor da empresa encerrar.
  { nome: "ivan ivanov", empresaChave: "integra", onda: "onda-2" },
  { nome: "willian leite", empresaChave: "integra", onda: "onda-2" },
  { nome: "fagner hara", empresaChave: "eqc", onda: "onda-2" },
  { nome: "bruno ribeiro", empresaChave: "eqc", onda: "onda-2" },
  { nome: "thiago tortato", empresaChave: "baggio", onda: "onda-2" },
  { nome: "jean santos", empresaChave: "baggio", onda: "onda-2" },
  { nome: "adriana abdala", empresaChave: "hausen", onda: "onda-2" },
  { nome: "bruna finamore", empresaChave: "hausen", onda: "onda-2" },
  { nome: "diego santos", empresaChave: "sugoi", onda: "onda-2" },
  { nome: "paulo campanile", empresaChave: "costa feitosa", onda: "onda-2" },
  { nome: "tiago leite", empresaChave: "gpe", onda: "onda-2" },
  { nome: "klaus zaffarani", empresaChave: "lindenberg", onda: "onda-2" },
  { nome: "milena fernandes", empresaChave: "fulwood", onda: "onda-2" },
  { nome: "ricardo da cruz", empresaChave: "holos", onda: "onda-2" },
];

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const dryRun = process.argv.includes("--dry-run");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");

  await runExclusive("reativar-indicacao", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const excluidos = contacts.filter((c) => c.status === "excluded");
    const mudados: string[] = [];

    for (const alvo of ALVOS) {
      const matches = excluidos.filter((c) => {
        const nomeCompleto = `${c.nome} ${c.sobrenome ?? ""}`.trim().toLowerCase();
        return nomeCompleto === alvo.nome && (c.empresa ?? "").toLowerCase().includes(alvo.empresaChave);
      });
      if (matches.length !== 1) {
        throw new Error(
          `alvo "${alvo.nome}" (${alvo.empresaChave}): ${matches.length} match(es) — abortando, nada gravado`,
        );
      }
      const c = matches[0];
      c.status = "active";
      c.custom.reativacao = `validacao-indicacao 2026-09-07 ${alvo.onda}`;
      mudados.push(`${c.nome} ${c.sobrenome ?? ""} · ${c.empresa} · ${alvo.onda}`);
    }

    if (dryRun) {
      console.log("DRY-RUN — reativaria:");
      for (const m of mudados) console.log(`  ${m}`);
      return;
    }
    await store.saveContacts(contacts);
    console.log(`✓ ${mudados.length} contato(s) reativado(s):`);
    for (const m of mudados) console.log(`  ${m}`);
  });
}

void main();

export {};
