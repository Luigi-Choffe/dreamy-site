/**
 * Mescla aberturas escritas (JSON {aberturas:[{dominio,abertura}]}) no store de
 * empresas e VALIDA cada uma renderizando o E1 real da campanha + lint + regras
 * de forma. Uso: pnpm tsx scripts/dev/merge-aberturas.ts <aberturas.json> [--apply]
 */
import { readFileSync } from "node:fs";
import { campaigns } from "../../src/content/outbound";
import { buildEmail, lintEmail, lintErrors } from "../../src/lib/outbound/render";
import { openStore } from "../../src/lib/outbound/store";
import type { Contact } from "../../src/lib/outbound/types";

const [, , file, applyFlag] = process.argv;
if (!file) {
  console.error("Uso: pnpm tsx scripts/dev/merge-aberturas.ts <aberturas.json> [--apply]");
  process.exit(1);
}
const apply = applyFlag === "--apply";
const data = JSON.parse(readFileSync(file, "utf8")) as { aberturas: Array<{ dominio: string; abertura: string }> };
const campaign = campaigns.find((c) => c.slug === "construcao-nova-receita");
if (!campaign) throw new Error("campanha construcao-nova-receita não registrada");
const e1 = campaign.steps[0];

function formIssues(abertura: string): string[] {
  const issues: string[] = [];
  const words = abertura.split(/\s+/).filter(Boolean).length;
  if (words > 26) issues.push(`${words} palavras (máx. 26)`);
  if (!/^[a-zà-ü]/.test(abertura)) issues.push("não começa com minúscula");
  if (!/\.$/.test(abertura.trim())) issues.push("não termina com ponto");
  if (/\{\{|\}\}/.test(abertura)) issues.push("contém chaves {{}}");
  if (/[!"“”]/.test(abertura)) issues.push("exclamação/aspas");
  if (/impressionante|parabéns|referência no|líder|incrível/i.test(abertura)) issues.push("elogio proibido");
  return issues;
}

async function main() {
  const store = openStore();
  const companies = await store.companies();
  const byDomain = new Map(companies.map((c) => [c.dominio, c]));
  let ok = 0;
  let merged = 0;
  const problems: string[] = [];
  const seenStarts = new Map<string, number>();

  for (const { dominio, abertura } of data.aberturas) {
    const company = byDomain.get(dominio);
    if (!company) {
      problems.push(`${dominio}: domínio não encontrado no store`);
      continue;
    }
    const issues = formIssues(abertura);
    const start = abertura.split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    seenStarts.set(start, (seenStarts.get(start) ?? 0) + 1);

    const contact: Contact = {
      id: "probe",
      email: `probe@${dominio}`,
      nome: "Carlos",
      empresa: company.nome,
      industria: campaign!.industria,
      custom: { abertura },
      importBatchId: "probe",
      verification: "ok",
      status: "active",
      createdAt: new Date().toISOString(),
    };
    try {
      const built = buildEmail(contact, campaign!, e1!, { replyTo: "probe@dreamy.app.br" });
      const errors = lintErrors(lintEmail(built.subject, built.text, { subjectTemplate: e1!.subject }));
      for (const e of errors) issues.push(`lint: ${e.rule} (${e.detail})`);
    } catch (err) {
      issues.push(`render: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (issues.length > 0) {
      problems.push(`${dominio} (${company.nome}): ${issues.join("; ")}\n    "${abertura}"`);
    } else {
      ok += 1;
      if (apply) {
        company.custom.abertura = abertura;
        merged += 1;
      }
    }
  }

  const semAbertura = companies.filter((c) => !data.aberturas.some((a) => a.dominio === c.dominio));
  const repetidos = [...seenStarts.entries()].filter(([, n]) => n > 8);

  console.log(`Validação: ${ok} ok · ${problems.length} com problema · ${semAbertura.length} empresas sem abertura`);
  if (repetidos.length > 0)
    console.log(`Inícios repetidos demais: ${repetidos.map(([s, n]) => `"${s}" ×${n}`).join(", ")}`);
  for (const p of problems) console.log(`  ✖ ${p}`);
  if (semAbertura.length > 0) console.log(`  Sem abertura: ${semAbertura.map((c) => c.dominio).join(", ")}`);

  if (apply) {
    await store.saveCompanies(companies);
    console.log(`Gravado: ${merged} aberturas no store de empresas.`);
  } else {
    console.log("Dry-run — repita com --apply para gravar as OK.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
