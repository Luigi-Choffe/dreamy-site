import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Company, Contact } from "./types";

/**
 * Lógica pura de importação da lista do Clay (PRD-EMAIL-OUTBOUND §5, §11).
 * Sem fs e sem store: recebe cabeçalhos/linhas + contexto (e-mails existentes,
 * supressões) e devolve contatos prontos + relatório. Quem grava é o CLI
 * (`scripts/outbound/import.ts`).
 *
 * Regra de auditoria (PRD §5): contato fora do ICP nunca é descartado
 * silenciosamente — entra como `excluded` com motivo. Linhas inválidas
 * (e-mail quebrado, sem nome) não viram contato, mas aparecem no relatório.
 */

// ─── Normalização ────────────────────────────────────────────────────────────

/** trim + minúsculas + sem acento + espaços colapsados. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Cabeçalho de coluna normalizado (chave de matching do mapa e do `custom`). */
export function normalizeHeader(header: string): string {
  return normalizeText(header);
}

/** Limpa domínio/URL: sem protocolo, sem www., sem caminho (PRD §11.4). */
export function cleanDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\/+$/, "");
}

// ─── Mapeamento de colunas ───────────────────────────────────────────────────

export const CONTACT_FIELDS = [
  "email",
  "nome",
  "sobrenome",
  "cargo",
  "empresa",
  "dominio",
  "industria",
  "porte",
  "linkedin",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Aliases de cabeçalho por campo (comparação via normalizeHeader). */
export type HeaderMapping = Record<ContactField, string[]>;

export interface MappedRow {
  /** Linha na planilha original (1 = cabeçalho; dados começam em 2). */
  rowNumber: number;
  fields: Partial<Record<ContactField, string>>;
  /** Colunas não mapeadas (chave = cabeçalho normalizado) — viram `Contact.custom`. */
  custom: Record<string, string>;
}

/**
 * Aplica o mapeamento de cabeçalhos às linhas. A primeira coluna que casar com um
 * campo vence; colunas repetidas ou não mapeadas caem em `custom`. Valores vazios
 * são omitidos.
 */
export function mapRows(headers: string[], rows: string[][], mapping: HeaderMapping): MappedRow[] {
  const aliasToField = new Map<string, ContactField>();
  for (const field of CONTACT_FIELDS) {
    for (const alias of mapping[field]) aliasToField.set(normalizeHeader(alias), field);
  }

  // coluna → campo (primeira ocorrência de cada campo vence) ou chave de custom
  type ColumnTarget = { kind: "field"; field: ContactField } | { kind: "custom"; key: string };
  const fieldTaken = new Set<ContactField>();
  const columns: ColumnTarget[] = headers.map((header) => {
    const normalized = normalizeHeader(header);
    const field = aliasToField.get(normalized);
    if (field && !fieldTaken.has(field)) {
      fieldTaken.add(field);
      return { kind: "field", field };
    }
    return { kind: "custom", key: normalized };
  });

  return rows.map((row, i) => {
    const mapped: MappedRow = { rowNumber: i + 2, fields: {}, custom: {} };
    columns.forEach((col, c) => {
      const value = (row[c] ?? "").trim();
      if (value === "") return;
      if (col.kind === "field") {
        mapped.fields[col.field] = value;
      } else if (col.key !== "") {
        let key = col.key;
        let n = 2;
        while (key in mapped.custom) key = `${col.key} (${n++})`; // colunas homônimas
        mapped.custom[key] = value;
      }
    });
    return mapped;
  });
}

// ─── Validação e filtros de ICP ──────────────────────────────────────────────

const rowSchema = z.object({
  email: z.email({ error: "e-mail inválido" }),
  nome: z.string().min(1, { error: "nome vazio" }),
});

/** Domínios de e-mail pessoal (PRD §5: e-mail pessoal está fora do ICP). */
export const PERSONAL_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "live.com.br",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "mail.com",
  "zoho.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "globomail.com",
  "ig.com.br",
  "r7.com",
  "oi.com.br",
  "zipmail.com.br",
]);

export function isPersonalEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return PERSONAL_EMAIL_DOMAINS.has(domain);
}

/**
 * Palavras-chave de cargos-alvo do ICP (PRD §5: falar com quem sente impacto
 * econômico). Configurável por importação; contato SEM cargo vira warning, não
 * exclusão.
 */
export const DEFAULT_TARGET_ROLES: readonly string[] = [
  "fundador",
  "founder",
  "founding", // "Founding Partner"
  "cofounder",
  "cofundador",
  "socio",
  "sócio",
  "ceo",
  "presidente",
  "diretor",
  "director",
  "coo",
  "cto",
  "head",
  "vp",
  "dono",
  "proprietário",
  "proprietario",
  "gerente geral",
];

/** token casa com a palavra-chave exata ou com flexão simples (diretor → diretora/diretores). */
function tokenMatches(token: string, keyword: string): boolean {
  if (token === keyword) return true;
  if (!token.startsWith(keyword)) return false;
  const suffix = token.slice(keyword.length);
  return suffix === "a" || suffix === "s" || suffix === "as" || suffix === "es";
}

/** Matching case/acento-insensitive por palavras (evita falso positivo tipo "vp" em "vpn"). */
export function matchesTargetRole(cargo: string, keywords: readonly string[] = DEFAULT_TARGET_ROLES): boolean {
  const tokens = normalizeText(cargo)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const joined = ` ${tokens.join(" ")} `;
  return keywords.some((raw) => {
    const kwTokens = normalizeText(raw)
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (kwTokens.length === 0) return false;
    if (kwTokens.length > 1) return joined.includes(` ${kwTokens.join(" ")} `); // ex.: "gerente geral"
    return tokens.some((token) => tokenMatches(token, kwTokens[0] as string));
  });
}

// ─── Importação (pura) ───────────────────────────────────────────────────────

export type ExclusionReason = "email-pessoal" | "cargo-fora-icp";

export interface RowIssue {
  rowNumber: number;
  email?: string;
  detail: string;
}

export interface ImportStats {
  totalRows: number;
  /** Contatos novos com status `active`. */
  imported: number;
  excluded: Record<ExclusionReason, number>;
  /** E-mails presentes na lista de supressão (entram como status `suppressed`, nunca `active`). */
  suppressed: number;
  duplicatesInBatch: number;
  duplicatesExisting: number;
  invalid: number;
  /** Distribuição dos contatos `active` por indústria (desc). */
  byIndustria: Array<{ label: string; count: number }>;
  /** Top 10 cargos dos contatos `active` (desc). */
  topCargos: Array<{ label: string; count: number }>;
}

export interface PrepareImportInput {
  headers: string[];
  rows: string[][];
  mapping: HeaderMapping;
  /** Id do ImportBatch que o CLI vai gravar junto. */
  batchId: string;
  /** E-mails (normalizados) já existentes no store — dedupe global. */
  existingEmails?: ReadonlySet<string>;
  /** E-mails (normalizados) na lista de supressão — nunca reentram como `active` (PRD §11.7). */
  suppressedEmails?: ReadonlySet<string>;
  /** Palavras-chave de cargo-alvo (default: DEFAULT_TARGET_ROLES). */
  targetRoles?: readonly string[];
  now?: Date;
  /** Injetável em teste; default randomUUID. */
  makeId?: () => string;
}

export interface PrepareImportResult {
  /** Contatos novos a gravar (status active | excluded | suppressed). */
  contacts: Contact[];
  invalid: RowIssue[];
  duplicatesInBatch: RowIssue[];
  duplicatesExisting: RowIssue[];
  /** Avisos que não excluem (ex.: contato sem cargo). */
  warnings: RowIssue[];
  stats: ImportStats;
}

function countBy(values: string[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values) {
    const key = normalizeText(value);
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { label: value.trim(), count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function prepareImport(input: PrepareImportInput): PrepareImportResult {
  const {
    headers,
    rows,
    mapping,
    batchId,
    existingEmails = new Set<string>(),
    suppressedEmails = new Set<string>(),
    targetRoles = DEFAULT_TARGET_ROLES,
    now = new Date(),
    makeId = randomUUID,
  } = input;

  const result: PrepareImportResult = {
    contacts: [],
    invalid: [],
    duplicatesInBatch: [],
    duplicatesExisting: [],
    warnings: [],
    stats: {
      totalRows: rows.length,
      imported: 0,
      excluded: { "email-pessoal": 0, "cargo-fora-icp": 0 },
      suppressed: 0,
      duplicatesInBatch: 0,
      duplicatesExisting: 0,
      invalid: 0,
      byIndustria: [],
      topCargos: [],
    },
  };

  const seenInBatch = new Set<string>();
  const createdAt = now.toISOString();

  for (const row of mapRows(headers, rows, mapping)) {
    const email = (row.fields.email ?? "").trim().toLowerCase();
    const nome = (row.fields.nome ?? "").trim();

    const parsed = rowSchema.safeParse({ email, nome });
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
      result.invalid.push({ rowNumber: row.rowNumber, email: email || undefined, detail });
      continue;
    }

    if (seenInBatch.has(email)) {
      result.duplicatesInBatch.push({ rowNumber: row.rowNumber, email, detail: "e-mail repetido no lote" });
      continue;
    }
    seenInBatch.add(email);

    if (existingEmails.has(email)) {
      result.duplicatesExisting.push({ rowNumber: row.rowNumber, email, detail: "contato já existe no store" });
      continue;
    }

    const cargo = row.fields.cargo;
    let status: Contact["status"] = "active";
    let excludedReason: string | undefined;

    if (suppressedEmails.has(email)) {
      status = "suppressed"; // PRD §11.7 — supressão é sagrada, nunca reentra como active
    } else if (isPersonalEmail(email)) {
      status = "excluded";
      excludedReason = "email-pessoal";
    } else if (cargo && !matchesTargetRole(cargo, targetRoles)) {
      status = "excluded";
      excludedReason = "cargo-fora-icp";
    } else if (!cargo) {
      result.warnings.push({ rowNumber: row.rowNumber, email, detail: "contato sem cargo — revisar ICP manualmente" });
    }

    const contact: Contact = {
      id: makeId(),
      email,
      nome,
      sobrenome: row.fields.sobrenome,
      cargo,
      empresa: row.fields.empresa,
      dominio: row.fields.dominio ? cleanDomain(row.fields.dominio) : undefined,
      industria: row.fields.industria,
      porte: row.fields.porte,
      linkedin: row.fields.linkedin,
      custom: row.custom,
      importBatchId: batchId,
      verification: "unverified",
      status,
      excludedReason,
      createdAt,
    };
    result.contacts.push(contact);

    if (status === "active") result.stats.imported++;
    else if (status === "suppressed") result.stats.suppressed++;
    else if (excludedReason) result.stats.excluded[excludedReason as ExclusionReason]++;
  }

  result.stats.duplicatesInBatch = result.duplicatesInBatch.length;
  result.stats.duplicatesExisting = result.duplicatesExisting.length;
  result.stats.invalid = result.invalid.length;

  const active = result.contacts.filter((c) => c.status === "active");
  result.stats.byIndustria = countBy(active.map((c) => c.industria ?? "(sem indústria)"));
  result.stats.topCargos = countBy(active.map((c) => c.cargo ?? "(sem cargo)")).slice(0, 10);

  return result;
}

// ─── Enriquecimento por empresa (tabela de companies do Clay) ────────────────

/** Índice de empresas por domínio normalizado (chave do join com contatos). */
export function companiesByDomain(companies: Company[]): Map<string, Company> {
  const map = new Map<string, Company>();
  for (const company of companies) {
    if (company.dominio) map.set(company.dominio, company);
  }
  return map;
}

/**
 * Preenche o contato com dados da empresa correspondente (match por domínio do
 * contato ou do e-mail). Campos do contato PREVALECEM; custom da empresa entra
 * apenas onde o contato não tem a chave (ex.: {{abertura}}, {{clientes_ativos}}).
 * Retorna true se algo foi preenchido.
 */
export function enrichContactFromCompany(contact: Contact, byDomain: Map<string, Company>): boolean {
  const emailDomain = contact.email.split("@")[1] ?? "";
  const key = contact.dominio ? cleanDomain(contact.dominio) : cleanDomain(emailDomain);
  const company = byDomain.get(key) ?? byDomain.get(cleanDomain(emailDomain));
  if (!company) return false;

  let changed = false;
  if (!contact.empresa && company.nome) {
    contact.empresa = company.nome;
    changed = true;
  }
  // Indústria: a da tabela de empresas PREVALECE — é curada/segmentada por nós
  // (ex.: "construção incorporadora"), enquanto a da pessoa vem crua do LinkedIn.
  if (company.industria && contact.industria !== company.industria) {
    contact.industria = company.industria;
    changed = true;
  }
  if (!contact.porte && company.porte) {
    contact.porte = company.porte;
    changed = true;
  }
  if (!contact.dominio && company.dominio) {
    contact.dominio = company.dominio;
    changed = true;
  }
  for (const [k, v] of Object.entries(company.custom)) {
    if (contact.custom[k] === undefined && v.trim() !== "") {
      contact.custom[k] = v;
      changed = true;
    }
  }
  return changed;
}
