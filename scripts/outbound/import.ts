/**
 * Dreamy Outbound — importação da lista do Clay (PRD-EMAIL-OUTBOUND §11).
 *
 * Uso:
 *   pnpm outbound:import --file lista.xlsx --origin "Clay run 2026-08, fontes: Apollo+site" [--dry-run]
 *
 * Fluxo: parse (.csv/.xlsx) → mapeamento de colunas (import-map.ts) → validação/
 * dedupe/filtros de ICP (import-core) → checagem de supressão → gravação no store
 * (contacts + ImportBatch). Com --dry-run só imprime o relatório, sem gravar.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import {
  companiesByDomain,
  enrichContactFromCompany,
  prepareImport,
  type RowIssue,
} from "../../src/lib/outbound/import-core";
import { parseCsv, parseXlsx, type ParsedTable } from "../../src/lib/outbound/parse";
import { newId, normalizeEmail, openStore, runExclusive } from "../../src/lib/outbound/store";
import type { ImportBatch } from "../../src/lib/outbound/types";
import { CLAY_HEADER_MAP } from "./import-map";

const USAGE = `Uso: pnpm outbound:import --file <lista.xlsx|lista.csv> --origin "<origem do run do Clay>" [--sheet <nome|índice>] [--dry-run]

  --file     caminho do export do Clay (.xlsx ou .csv)
  --origin   procedência declarada do lote (LGPD §18 — ex.: "Clay run 2026-08, fontes: Apollo+site")
  --sheet    aba do .xlsx (nome ou índice 0-based); default: primeira
  --dry-run  só imprime o relatório; não grava nada no store`;

function printIssues(title: string, issues: RowIssue[], limit = 20): void {
  if (issues.length === 0) return;
  console.log(`\n${title} (${issues.length}):`);
  for (const issue of issues.slice(0, limit)) {
    console.log(`  linha ${String(issue.rowNumber).padStart(5)}  ${issue.email ?? "(sem e-mail)"}  ${issue.detail}`);
  }
  if (issues.length > limit) console.log(`  … e mais ${issues.length - limit}.`);
}

function printDistribution(title: string, entries: Array<{ label: string; count: number }>): void {
  console.log(`\n${title}:`);
  if (entries.length === 0) {
    console.log("  (nenhum contato ativo)");
    return;
  }
  const width = Math.max(...entries.map((e) => e.label.length), 10);
  for (const { label, count } of entries) {
    console.log(`  ${label.padEnd(width)}  ${count}`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      origin: { type: "string" },
      sheet: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const file = values.file;
  const origin = values.origin?.trim();
  const dryRun = values["dry-run"] === true;
  if (!file || !origin) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const buffer = await fs.readFile(file);
  let table: ParsedTable;
  if (ext === ".csv") table = parseCsv(buffer);
  else if (ext === ".xlsx") {
    // --sheet: nome ou índice 0-based da aba (o Clay exporta empresas e pessoas em abas distintas)
    const sheet =
      values.sheet === undefined ? undefined : /^\d+$/.test(values.sheet) ? Number(values.sheet) : values.sheet;
    table = parseXlsx(buffer, { sheet });
  } else throw new Error(`Extensão "${ext}" não suportada — use .xlsx ou .csv.`);

  const store = openStore();
  const existing = await store.contacts();
  const suppressions = await store.suppressions();
  const batchId = newId();

  const result = prepareImport({
    headers: table.headers,
    rows: table.rows,
    mapping: CLAY_HEADER_MAP,
    batchId,
    existingEmails: new Set(existing.map((c) => normalizeEmail(c.email))),
    // mesmo critério de store.isSuppressed, carregado uma vez para o lote inteiro
    suppressedEmails: new Set(suppressions.map((s) => normalizeEmail(s.email))),
  });
  const { stats } = result;
  const excludedTotal = stats.excluded["email-pessoal"] + stats.excluded["cargo-fora-icp"];

  console.log(`\nImportação — ${path.basename(file)}`);
  console.log(`Origem do lote: ${origin}`);
  console.log(`Modo: ${dryRun ? "DRY-RUN (nada será gravado)" : "gravação no store"}`);
  console.log("\nResumo:");
  console.log(`  Linhas de dados ............. ${stats.totalRows}`);
  console.log(`  Importados (ativos) ......... ${stats.imported}`);
  console.log(`  Excluídos: e-mail pessoal ... ${stats.excluded["email-pessoal"]}`);
  console.log(`  Excluídos: cargo fora ICP ... ${stats.excluded["cargo-fora-icp"]}`);
  console.log(`  Suprimidos (opt-out prévio) . ${stats.suppressed}`);
  console.log(`  Duplicados no lote .......... ${stats.duplicatesInBatch}`);
  console.log(`  Duplicados já no store ...... ${stats.duplicatesExisting}`);
  console.log(`  Inválidos ................... ${stats.invalid}`);

  printIssues("Linhas inválidas (não importadas)", result.invalid);
  printIssues("Duplicados no lote", result.duplicatesInBatch);
  printIssues("Já existentes no store", result.duplicatesExisting);
  printIssues("Avisos", result.warnings);

  // Join com a tabela de empresas (outbound:companies): preenche empresa/indústria/
  // porte vazios e injeta custom ({{abertura}}, {{clientes_ativos}}…) por domínio.
  const companies = await store.companies();
  let enriquecidos = 0;
  if (companies.length > 0) {
    const byDomain = companiesByDomain(companies);
    for (const contact of result.contacts) {
      if (enrichContactFromCompany(contact, byDomain)) enriquecidos += 1;
    }
    console.log(`  Enriquecidos (empresas) ..... ${enriquecidos} (join por domínio, ${companies.length} empresas)`);
  }

  // Distribuições calculadas APÓS o enriquecimento (o join pode ter preenchido indústria).
  const ativos = result.contacts.filter((c) => c.status === "active");
  const distribuicao = (labels: string[]) => {
    const map = new Map<string, number>();
    for (const label of labels) map.set(label, (map.get(label) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  };
  printDistribution(
    "Distribuição por indústria (ativos)",
    distribuicao(ativos.map((c) => c.industria ?? "(sem indústria)")),
  );
  printDistribution("Cargos (top 10, ativos)", distribuicao(ativos.map((c) => c.cargo ?? "(sem cargo)")).slice(0, 10));

  if (!dryRun) {
    const batch: ImportBatch = {
      id: batchId,
      file: path.basename(file),
      origin,
      importedAt: new Date().toISOString(),
      rows: stats.totalRows,
      imported: stats.imported,
      excluded: excludedTotal + stats.suppressed,
      duplicates: stats.duplicatesInBatch + stats.duplicatesExisting,
      invalid: stats.invalid,
    };
    await store.saveContacts([...existing, ...result.contacts]);
    const batches = await store.imports();
    batches.push(batch);
    await store.saveImports(batches);
    console.log(`\nLote gravado: ${batchId} (${result.contacts.length} contatos novos em ${store.dir}).`);
  } else {
    console.log("\nDRY-RUN: nada foi gravado. Repita sem --dry-run para importar.");
  }

  // Auditoria sem PII (só contagens e ids — PRD §20.6)
  logger.info("outbound.import", {
    batchId,
    file: path.basename(file),
    dryRun,
    rows: stats.totalRows,
    imported: stats.imported,
    excluded: excludedTotal,
    suppressed: stats.suppressed,
    duplicates: stats.duplicatesInBatch + stats.duplicatesExisting,
    invalid: stats.invalid,
  });

  console.log(
    '\nLembrete: contatos entram como verification=unverified — rode "pnpm outbound:verify" antes de enviar.',
  );
}

runExclusive("import", main).catch((err: unknown) => {
  console.error(`\nErro na importação: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
