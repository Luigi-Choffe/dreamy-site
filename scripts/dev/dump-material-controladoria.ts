// One-off (2026-10-13): material de personalização da onda 1 de CONTROLADORIA para os
// redatores (VERBO): id, nome, cargo, empresa, headline e Sobre do LinkedIn, em lotes
// JSON fora do repositório (scratchpad). SEM e-mail. Só leitura.
// Uso: pnpm tsx scripts/dev/dump-material-controladoria.ts <pasta-saida> [lotes=5]
import fs from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function main(): Promise<void> {
  const out = process.argv[2];
  const lotes = Number(process.argv[3] ?? 5);
  if (!out) throw new Error("informe a pasta de saída");
  const { openStore } = await import("../../src/lib/outbound/store");
  const contacts = await openStore().contacts();
  const onda1 = contacts
    .filter((c) => c.status === "active" && c.custom.cesta === "controladoria onda-1")
    .sort((a, b) => (a.empresa ?? "").localeCompare(b.empresa ?? "") || a.nome.localeCompare(b.nome));
  const material = onda1.map((c) => ({
    contactId: c.id,
    nome: c.nome,
    cargo: c.cargo ?? "",
    empresa: c.empresa ?? "",
    headline: String(c.custom.headline ?? ""),
    sobre: String(c.custom.summary ?? ""),
    colegasNaLista: onda1.filter((o) => o.id !== c.id && o.empresa === c.empresa).map((o) => o.nome),
  }));
  await fs.mkdir(out, { recursive: true });
  const tamanho = Math.ceil(material.length / lotes);
  for (let i = 0; i < lotes; i += 1) {
    const fatia = material.slice(i * tamanho, (i + 1) * tamanho);
    await fs.writeFile(path.join(out, `material-${i + 1}.json`), JSON.stringify({ contatos: fatia }, null, 2), "utf8");
    console.log(`lote ${i + 1}: ${fatia.length} contatos`);
  }
  console.log(`total: ${material.length} · pasta: ${out}`);
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
