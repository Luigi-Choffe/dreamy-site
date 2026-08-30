import { inflateRawSync } from "node:zlib";

/**
 * Parsers zero-dependência para a lista do Clay (PRD-EMAIL-OUTBOUND §11).
 * - parseCsv: RFC 4180 (aspas, delimitador dentro de aspas, aspas escapadas ""),
 *   BOM UTF-8, autodetecção de delimitador `,` ou `;` (Excel pt-BR exporta `;`).
 * - parseXlsx: leitor mínimo de .xlsx usando só node:zlib e Buffer. Cobre o xlsx
 *   previsível do Clay/Excel; qualquer coisa fora disso falha com mensagem clara
 *   sugerindo exportar CSV.
 *
 * Performance é irrelevante aqui (milhares de linhas no máximo) — clareza primeiro.
 */

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

// ─── CSV (RFC 4180) ──────────────────────────────────────────────────────────

/** Conta `,` × `;` fora de aspas na primeira linha e escolhe o delimitador. */
function detectDelimiter(text: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === "\n" || ch === "\r") break;
      if (ch === ",") commas++;
      else if (ch === ";") semis++;
    }
  }
  return semis > commas ? ";" : ",";
}

export function parseCsv(input: Buffer | string): ParsedTable {
  let text = typeof input === "string" ? input : input.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM UTF-8

  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    // linhas vazias (ou só de delimitadores) são ignoradas
    if (record.some((v) => v.trim() !== "")) records.push(record);
    record = [];
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // aspas escapadas ""
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch; // inclui delimitador e quebras de linha dentro de aspas
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRecord();
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRecord();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (inQuotes) {
    throw new Error("parseCsv: aspas abertas sem fechamento no fim do arquivo — exporte o CSV novamente.");
  }
  if (field !== "" || record.length > 0) pushRecord();

  if (records.length === 0) {
    throw new Error("parseCsv: arquivo vazio (nenhuma linha com conteúdo).");
  }
  const headers = (records[0] as string[]).map((h) => h.trim());
  return { headers, rows: records.slice(1) };
}

// ─── XLSX (ZIP + XML mínimos) ────────────────────────────────────────────────

const CSV_HINT = "Se o arquivo não abrir aqui, exporte a lista como CSV (no Clay ou no Excel) e importe o .csv.";

function fail(detail: string): never {
  throw new Error(`parseXlsx: ${detail} ${CSV_HINT}`);
}

const EOCD_SIG = 0x06054b50; // End of Central Directory
const CDIR_SIG = 0x02014b50; // Central Directory entry
const LOCAL_SIG = 0x04034b50; // Local file header

/** Lê todas as entradas do ZIP (métodos 0=stored e 8=deflate) para um Map nome → conteúdo. */
function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const MIN_EOCD = 22;
  if (buf.length < MIN_EOCD) fail("arquivo pequeno demais para ser um .xlsx (ZIP).");

  // EOCD fica no fim do arquivo (antes de um comentário de até 65535 bytes)
  let eocd = -1;
  const stop = Math.max(0, buf.length - MIN_EOCD - 65535);
  for (let i = buf.length - MIN_EOCD; i >= stop; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("assinatura ZIP não encontrada — o arquivo não parece ser um .xlsx.");

  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdirOffset = buf.readUInt32LE(eocd + 16);
  if (totalEntries === 0xffff || cdirOffset === 0xffffffff) fail("ZIP64 não é suportado.");

  const entries = new Map<string, Buffer>();
  let p = cdirOffset;
  for (let n = 0; n < totalEntries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CDIR_SIG) fail("diretório central do ZIP corrompido.");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");

    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LOCAL_SIG) {
      fail(`cabeçalho local inválido para "${name}".`);
    }
    // nameLen/extraLen do cabeçalho LOCAL podem diferir dos do diretório central
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(raw);
    } else if (method === 8) {
      try {
        data = inflateRawSync(raw);
      } catch {
        fail(`falha ao descomprimir "${name}".`);
      }
    } else {
      fail(`método de compressão ${method} não suportado em "${name}".`);
    }
    entries.set(name, data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// XML: os arquivos gerados pelo Excel/Clay são previsíveis; regex/state machine
// simples é suficiente (decisão do PRD §19 — sem dependência de parser XML).

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return XML_ENTITIES[code] ?? whole;
  });
}

/** Valor de um atributo (`name="valor"`) dentro de uma tag/lista de atributos. */
function attrValue(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? decodeXml(m[1] as string) : undefined;
}

/** Concatena o conteúdo de todos os `<t>` de um fragmento (runs, `xml:space="preserve"`, `<t/>`). */
function extractText(fragment: string): string {
  let text = "";
  const tRe = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(fragment)) !== null) text += decodeXml(m[1] ?? "");
  return text;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) out.push(extractText(m[1] as string));
  return out;
}

/** Resolve o Target de um relationship relativo a `xl/` (ou absoluto no pacote). */
function resolveSheetTarget(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = ["xl", ...target.replace(/^\.\//, "").split("/")];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== "") out.push(part);
  }
  return out.join("/");
}

interface SheetInfo {
  name: string;
  rid: string | undefined;
}

/** Abas declaradas em xl/workbook.xml, na ordem do workbook. */
function workbookSheets(entries: Map<string, Buffer>): SheetInfo[] {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8");
  if (!workbook) fail("xl/workbook.xml ausente — o ZIP não é uma planilha .xlsx.");
  const sheets: SheetInfo[] = [];
  const sheetRe = /<sheet\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = sheetRe.exec(workbook)) !== null) {
    sheets.push({
      name: decodeXml(attrValue(m[0], "name") ?? `sheet${sheets.length + 1}`),
      rid: attrValue(m[0], "r:id"),
    });
  }
  if (sheets.length === 0) fail("nenhuma planilha declarada em xl/workbook.xml.");
  return sheets;
}

/** Nomes das abas do workbook (para o usuário escolher `--sheet`). */
export function listXlsxSheets(input: Buffer): string[] {
  return workbookSheets(readZipEntries(input)).map((s) => s.name);
}

export interface XlsxOptions {
  /** Aba por nome (case-insensitive) ou índice 0-based. Default: primeira. */
  sheet?: string | number;
}

/** Caminho da sheet escolhida (via `r:id` + xl/_rels; fallback sheetN.xml). */
function sheetPath(entries: Map<string, Buffer>, selector: string | number | undefined): string {
  const sheets = workbookSheets(entries);
  let index = 0;
  if (typeof selector === "number") index = selector;
  else if (typeof selector === "string") {
    index = sheets.findIndex((s) => s.name.toLowerCase() === selector.trim().toLowerCase());
    if (index < 0) fail(`aba "${selector}" não existe — abas: ${sheets.map((s) => s.name).join(", ")}.`);
  }
  const chosen = sheets[index];
  if (!chosen) fail(`aba de índice ${index} não existe (${sheets.length} aba(s)).`);

  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (chosen.rid && rels) {
    const relRe = /<Relationship\b[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = relRe.exec(rels)) !== null) {
      if (attrValue(m[0], "Id") === chosen.rid) {
        const target = attrValue(m[0], "Target");
        if (target) return resolveSheetTarget(target);
      }
    }
  }
  const fallback = `xl/worksheets/sheet${index + 1}.xml`;
  if (entries.has(fallback)) return fallback;
  fail(`não foi possível localizar a aba "${chosen.name}" no workbook.`);
}

/** Converte a parte de letras de uma referência de célula ("BC12") em índice de coluna (0-based). */
function columnIndex(ref: string): number {
  let idx = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) idx = idx * 26 + (code - 64);
    else break;
  }
  return idx - 1; // sem letras → -1 (chamador usa posição sequencial)
}

function cellValue(attrs: string, inner: string, sharedStrings: string[]): string {
  const type = attrValue(attrs, "t") ?? "";
  if (type === "s") {
    const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
    const idx = v ? Number(decodeXml(v[1] as string).trim()) : NaN;
    if (!Number.isInteger(idx) || idx < 0 || idx >= sharedStrings.length) {
      fail(`referência de sharedStrings inválida (índice ${v ? v[1] : "ausente"}).`);
    }
    return sharedStrings[idx] as string;
  }
  if (type === "inlineStr") return extractText(inner);
  // t="str" (fórmula), numéricas, booleanas, sem tipo: valor cru de <v> serve (PRD: ignorar estilos/datas)
  const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  return v ? decodeXml(v[1] as string) : "";
}

export function parseXlsx(input: Buffer, opts: XlsxOptions = {}): ParsedTable {
  const entries = readZipEntries(input);
  const chosenPath = sheetPath(entries, opts.sheet);
  const sheetXml = entries.get(chosenPath)?.toString("utf8");
  if (!sheetXml) fail(`planilha "${chosenPath}" não encontrada dentro do arquivo.`);

  const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  const sharedStrings = sharedXml ? parseSharedStrings(sharedXml) : [];

  const records: string[][] = [];
  const rowRe = /<row\b[^>]*(?:\/>|>([\s\S]*?)<\/row>)/g;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheetXml)) !== null) {
    const rowInner = rowMatch[1];
    if (rowInner === undefined) continue; // <row/> vazia
    const cells: string[] = [];
    let nextCol = 0;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowInner)) !== null) {
      const attrs = cellMatch[1] ?? "";
      const inner = cellMatch[2] ?? "";
      const ref = attrValue(attrs, "r");
      let col = ref ? columnIndex(ref) : nextCol;
      if (col < 0) col = nextCol;
      while (cells.length < col) cells.push(""); // colunas puladas viram ""
      cells[col] = cellValue(attrs, inner, sharedStrings);
      nextCol = col + 1;
    }
    if (cells.some((v) => v.trim() !== "")) records.push(cells);
  }

  if (records.length === 0) fail("a primeira planilha está vazia (nenhuma linha com conteúdo).");
  const headers = (records[0] as string[]).map((h) => h.trim());
  return { headers, rows: records.slice(1) };
}
