/**
 * `pnpm outbound:companies <import|list|enrich-contacts>` — tabela de EMPRESAS do Clay.
 *
 * O Clay exporta empresas e pessoas em tabelas separadas. Esta importa a de
 * empresas (nome, descrição, indústria, porte, domínio + enriquecimento de
 * clientes ativos/ticket médio) e faz o JOIN por domínio com os contatos:
 * automático no `outbound:import` de pessoas, ou manual via `enrich-contacts`.
 *
 *   import --file <xlsx|csv> --origin "<procedência>" [--dry-run]
 *   list [--json]
 *   enrich-contacts [--dry-run]     re-aplica o join nos contatos já importados
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import {
  cleanDomain,
  companiesByDomain,
  enrichContactFromCompany,
  normalizeHeader,
} from "../../src/lib/outbound/import-core";
import { parseCsv, parseXlsx, type ParsedTable } from "../../src/lib/outbound/parse";
import { newId, openStore, runExclusive } from "../../src/lib/outbound/store";
import type { Company } from "../../src/lib/outbound/types";

/**
 * Aliases de cabeçalho → campo (tabela de companies do Clay; revisar a cada export
 * novo, como no import-map.ts). Colunas de status do Clay são ignoradas.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  nome: ["name", "company name", "use ai company name", "empresa"],
  descricao: ["description", "descricao", "about"],
  industria: ["primary industry", "industry", "industria", "setor"],
  porte: ["size", "company size", "employees", "headcount", "funcionarios"],
  tipo: ["type", "company type"],
  local: ["location", "city", "cidade"],
  dominio: ["domain", "company domain", "website", "use ai company domain"],
  linkedin: ["linkedin url", "linkedin", "company linkedin"],
};

/** Colunas extras que viram `custom` do contato no join (variáveis de template). */
const CUSTOM_ALIASES: Record<string, string[]> = {
  clientes_ativos: ["use ai number of clients", "number of clients", "clientes ativos"],
  ticket_medio: ["use ai average ticket value", "average ticket value", "ticket medio"],
  moeda: ["use ai currency", "currency"],
  notas_enriquecimento: ["use ai notes", "notes"],
  abertura: ["abertura", "opener", "first line", "icebreaker"],
};

/** Colunas de status/controle do Clay — nunca importadas. */
const IGNORED = new Set([
  "active clients & avg ticket",
  "country", // todas Brazil neste fluxo; local já carrega cidade/UF
]);

interface ColumnPlan {
  fields: Map<number, string>;
  custom: Map<number, string>;
  unmapped: string[];
}

function planColumns(headers: string[]): ColumnPlan {
  const fields = new Map<number, string>();
  const custom = new Map<number, string>();
  const unmapped: string[] = [];
  const taken = new Set<string>();
  headers.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    if (h === "" || IGNORED.has(h) || h.startsWith("update people search")) return;
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(h) && !taken.has(field)) {
        fields.set(idx, field);
        taken.add(field);
        return;
      }
    }
    for (const [key, aliases] of Object.entries(CUSTOM_ALIASES)) {
      if (aliases.includes(h) && !taken.has(`custom:${key}`)) {
        custom.set(idx, key);
        taken.add(`custom:${key}`);
        return;
      }
    }
    unmapped.push(raw);
  });
  return { fields, custom, unmapped };
}

async function readTable(file: string, sheet?: string): Promise<ParsedTable> {
  const ext = path.extname(file).toLowerCase();
  const buffer = await fs.readFile(file);
  if (ext === ".csv") return parseCsv(buffer);
  if (ext === ".xlsx") {
    const selector = sheet === undefined ? undefined : /^\d+$/.test(sheet) ? Number(sheet) : sheet;
    return parseXlsx(buffer, { sheet: selector });
  }
  throw new Error(`Extensão "${ext}" não suportada — use .xlsx ou .csv.`);
}

async function cmdImport(values: {
  file?: string;
  origin?: string;
  sheet?: string;
  "dry-run"?: boolean;
}): Promise<void> {
  const file = values.file;
  const origin = values.origin?.trim();
  const dryRun = values["dry-run"] === true;
  if (!file || !origin) {
    console.error(
      'Uso: pnpm outbound:companies import --file <xlsx|csv> --origin "<procedência>" [--sheet <nome|índice>] [--dry-run]',
    );
    process.exitCode = 1;
    return;
  }

  const table = await readTable(file, values.sheet);
  const plan = planColumns(table.headers);
  const store = openStore();
  const existing = await store.companies();
  const byDomain = companiesByDomain(existing);
  const batchId = newId();
  const now = new Date().toISOString();

  let novos = 0;
  let atualizados = 0;
  let semDominio = 0;
  let semNome = 0;
  const industrias = new Map<string, number>();
  let comClientes = 0;
  let comTicket = 0;

  for (const row of table.rows) {
    const record: Partial<Company> & { custom: Record<string, string> } = { custom: {} };
    plan.fields.forEach((field, idx) => {
      const v = row[idx]?.trim();
      if (v) (record as Record<string, unknown>)[field] = v;
    });
    plan.custom.forEach((key, idx) => {
      const v = row[idx]?.trim();
      if (v) record.custom[key] = v;
    });
    if (!record.nome) {
      semNome += 1;
      continue;
    }
    const dominio = record.dominio ? cleanDomain(record.dominio) : "";
    if (!dominio) {
      semDominio += 1;
      continue;
    }

    industrias.set(record.industria ?? "(sem indústria)", (industrias.get(record.industria ?? "(sem indústria)") ?? 0) + 1);
    if (record.custom.clientes_ativos) comClientes += 1;
    if (record.custom.ticket_medio) comTicket += 1;

    const found = byDomain.get(dominio);
    if (found) {
      // Atualização: campos novos preenchem vazios; custom novo prevalece (enriquecimento mais recente).
      found.nome = record.nome;
      if (record.descricao) found.descricao = record.descricao;
      if (record.industria) found.industria = record.industria;
      if (record.porte) found.porte = record.porte;
      if (record.tipo) found.tipo = record.tipo;
      if (record.local) found.local = record.local;
      if (record.linkedin) found.linkedin = record.linkedin;
      found.custom = { ...found.custom, ...record.custom };
      atualizados += 1;
    } else {
      const company: Company = {
        id: newId(),
        nome: record.nome,
        dominio,
        descricao: record.descricao,
        industria: record.industria,
        porte: record.porte,
        tipo: record.tipo,
        local: record.local,
        linkedin: record.linkedin,
        custom: record.custom,
        importBatchId: batchId,
        createdAt: now,
      };
      existing.push(company);
      byDomain.set(dominio, company);
      novos += 1;
    }
  }

  console.log(`\nEmpresas — ${path.basename(file)}`);
  console.log(`Origem: ${origin}`);
  console.log(`Modo: ${dryRun ? "DRY-RUN (nada será gravado)" : "gravação no store"}`);
  console.log("\nResumo:");
  console.log(`  Linhas ................. ${table.rows.length}`);
  console.log(`  Empresas novas ......... ${novos}`);
  console.log(`  Atualizadas (domínio) .. ${atualizados}`);
  console.log(`  Sem domínio (puladas) .. ${semDominio}`);
  console.log(`  Sem nome (puladas) ..... ${semNome}`);
  console.log(`  Com nº de clientes ..... ${comClientes}`);
  console.log(`  Com ticket médio ....... ${comTicket}`);
  console.log("\nPor indústria:");
  for (const [k, v] of [...industrias.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${v}`);
  }
  if (plan.unmapped.length > 0) {
    console.log(`\nColunas não mapeadas (ignoradas): ${plan.unmapped.join(" · ")}`);
    console.log("  (para usar alguma, adicione o alias em scripts/outbound/companies.ts)");
  }

  if (!dryRun) {
    await store.saveCompanies(existing);
    const batches = await store.imports();
    batches.push({
      id: batchId,
      file: `[empresas] ${path.basename(file)}`,
      origin,
      importedAt: now,
      rows: table.rows.length,
      imported: novos,
      excluded: semDominio + semNome,
      duplicates: atualizados,
      invalid: 0,
    });
    await store.saveImports(batches);
    console.log(`\nLote gravado: ${batchId} (${novos} novas, ${atualizados} atualizadas em ${store.dir}).`);
    console.log("Contatos futuros são enriquecidos automaticamente no outbound:import;");
    console.log("para contatos já importados: pnpm outbound:companies enrich-contacts");
  } else {
    console.log("\nDRY-RUN: nada foi gravado.");
  }
  logger.info("outbound.companies.import", {
    batchId,
    file: path.basename(file),
    dryRun,
    rows: table.rows.length,
    novos,
    atualizados,
    semDominio,
    semNome,
  });
}

async function cmdList(json: boolean): Promise<void> {
  const store = openStore();
  const companies = await store.companies();
  if (json) {
    console.log(JSON.stringify(companies, null, 2));
    return;
  }
  console.log(`Empresas no store: ${companies.length}`);
  for (const c of companies.slice(0, 30)) {
    const extras = [
      c.industria,
      c.porte,
      c.custom.clientes_ativos ? `${c.custom.clientes_ativos} clientes` : null,
      c.custom.ticket_medio ? `ticket ${c.custom.ticket_medio}` : null,
      c.custom.abertura ? "abertura ✓" : "abertura —",
    ]
      .filter(Boolean)
      .join(" · ");
    console.log(`  ${c.nome.padEnd(40).slice(0, 40)} ${c.dominio.padEnd(28).slice(0, 28)} ${extras}`);
  }
  if (companies.length > 30) console.log(`  … e mais ${companies.length - 30} (use --json para tudo).`);
}

async function cmdEnrichContacts(dryRun: boolean): Promise<void> {
  const store = openStore();
  const [contacts, companies] = await Promise.all([store.contacts(), store.companies()]);
  const byDomain = companiesByDomain(companies);
  let enriched = 0;
  for (const contact of contacts) {
    if (enrichContactFromCompany(contact, byDomain)) enriched += 1;
  }
  console.log(`Contatos enriquecidos pelo join de empresas: ${enriched} de ${contacts.length}.`);
  if (!dryRun && enriched > 0) {
    await store.saveContacts(contacts);
    console.log("Gravado.");
  } else if (dryRun) {
    console.log("DRY-RUN: nada gravado.");
  }
  logger.info("outbound.companies.enrich", { enriched, total: contacts.length, dryRun });
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      file: { type: "string" },
      origin: { type: "string" },
      sheet: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
  });
  const cmd = positionals[0] ?? "list";
  if (cmd === "import") return cmdImport(values);
  if (cmd === "list") return cmdList(values.json === true);
  if (cmd === "enrich-contacts") return cmdEnrichContacts(values["dry-run"] === true);
  console.error(`Subcomando desconhecido: "${cmd}". Use: import | list | enrich-contacts.`);
  process.exitCode = 1;
}

runExclusive("companies", main).catch((err: unknown) => {
  console.error(`\nErro: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
