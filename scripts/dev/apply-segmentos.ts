/**
 * Aplica a classificação de segmentos no store de empresas:
 * `industria` vira "construção <segmento>" (chave de enroll das campanhas),
 * o valor original do Clay é preservado em custom.industria_clay e o motivo
 * em custom.segmento_motivo. Uso: pnpm tsx scripts/dev/apply-segmentos.ts <classificacoes.json>
 */
import { readFileSync } from "node:fs";
import { openStore } from "../../src/lib/outbound/store";

const file = process.argv[2];
if (!file) {
  console.error("Uso: pnpm tsx scripts/dev/apply-segmentos.ts <classificacoes.json>");
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, "utf8")) as {
  classificacoes: Array<{ dominio: string; segmento: string; motivo: string }>;
};

const LABELS: Record<string, string> = {
  incorporadora: "construção incorporadora",
  "construtora-obras": "construção obras para terceiros",
  "fornecedor-produto": "construção fornecedor",
  "servicos-engenharia": "construção serviços de engenharia",
  "fora-do-perfil": "fora do perfil",
};

async function main() {
  const store = openStore();
  const companies = await store.companies();
  const byDomain = new Map(companies.map((c) => [c.dominio, c]));
  const counts = new Map<string, number>();
  const missing: string[] = [];

  for (const { dominio, segmento, motivo } of data.classificacoes) {
    const company = byDomain.get(dominio);
    if (!company) {
      missing.push(dominio);
      continue;
    }
    const label = LABELS[segmento];
    if (!label) {
      missing.push(`${dominio} (segmento desconhecido: ${segmento})`);
      continue;
    }
    if (!company.custom.industria_clay && company.industria) {
      company.custom.industria_clay = company.industria;
    }
    company.industria = label;
    company.custom.segmento = segmento;
    company.custom.segmento_motivo = motivo;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  await store.saveCompanies(companies);
  console.log("Segmentos aplicados:");
  for (const [label, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(38)} ${n}`);
  }
  if (missing.length > 0) console.log(`Não aplicados: ${missing.join(", ")}`);
  const foraDoPerfil = companies.filter((c) => c.custom.segmento === "fora-do-perfil");
  for (const c of foraDoPerfil) {
    console.log(`  ⚠ fora do perfil: ${c.dominio} (${c.nome}) — ${c.custom.segmento_motivo}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
