// Diagnóstico read-only dos exports do Clay em docs/CONTATOS/LOGISTICA (gitignored):
// contagens, cargos, empresas repetidas, cobertura de e-mail/Summary. Sem PII no stdout.
// Uso: pnpm tsx scripts/dev/dump-logistica.ts

import fs from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "../../src/lib/outbound/parse";
import { isPersonalEmail, DEFAULT_TARGET_ROLES } from "../../src/lib/outbound/import-core";

const DIR = path.join("docs", "CONTATOS", "LOGISTICA");

function col(headers: string[], name: string): number {
  return headers.findIndex((h) => h.replace(/\s+/g, " ").trim().toLowerCase() === name);
}

async function main(): Promise<void> {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".csv")).sort();
  let total = 0;
  const cargos = new Map<string, number>();
  const empresas = new Map<string, number>();
  const emails = new Set<string>();
  let comEmail = 0;
  let pessoal = 0;
  let comSummary = 0;
  let comResumoIa = 0;
  let dupEmail = 0;
  let icpOk = 0;
  const roleTokens = DEFAULT_TARGET_ROLES.map((r) => r.toLowerCase());

  for (const f of files) {
    const table = parseCsv(await fs.readFile(path.join(DIR, f)));
    const h = table.headers;
    const iCargo = col(h, "job title");
    const iEmpresa = col(h, "company");
    const iEmail = col(h, "work email");
    const iSummary = col(h, "summary");
    const iResumo = col(h, "summarize linkedin profile");
    console.log(`${f.slice(-12)}: ${table.rows.length} linhas`);
    for (const r of table.rows) {
      total++;
      const cargo = (r[iCargo] ?? "").trim();
      const empresa = (r[iEmpresa] ?? "").trim();
      const email = (r[iEmail] ?? "").trim().toLowerCase();
      cargos.set(cargo.toLowerCase(), (cargos.get(cargo.toLowerCase()) ?? 0) + 1);
      if (empresa) empresas.set(empresa, (empresas.get(empresa) ?? 0) + 1);
      if (email) {
        comEmail++;
        if (emails.has(email)) dupEmail++;
        emails.add(email);
        if (isPersonalEmail(email)) pessoal++;
      }
      if ((r[iSummary] ?? "").trim().length > 40) comSummary++;
      if ((r[iResumo] ?? "").trim().length > 40) comResumoIa++;
      const c = cargo.toLowerCase();
      if (roleTokens.some((t) => c.includes(t))) icpOk++;
    }
  }
  console.log(
    `\nTOTAL: ${total} linhas · com e-mail: ${comEmail} · pessoais: ${pessoal} · duplicados entre arquivos: ${dupEmail}`,
  );
  console.log(`Summary (Sobre) preenchido: ${comSummary} · resumo IA do perfil: ${comResumoIa}`);
  console.log(`cargo casa com ICP atual (diretor/C-level/sócio…): ${icpOk} · fora do ICP atual: ${total - icpOk}`);
  const multi = [...empresas].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  console.log(`\nEmpresas: ${empresas.size} · com 2+ contatos: ${multi.length}`);
  for (const [e, n] of multi.slice(0, 25)) console.log(`  ${n}× ${e}`);
  console.log(`\nCargos (top 30):`);
  for (const [c, n] of [...cargos].sort((a, b) => b[1] - a[1]).slice(0, 30))
    console.log(`  ${n}× ${c || "(sem cargo)"}`);
}

void main();

export {};
