import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseCsv, parseXlsx } from "@/lib/outbound/parse";

// ─── parseCsv (RFC 4180) ─────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("separa cabeçalho e linhas com vírgula", () => {
    const { headers, rows } = parseCsv("Email,Nome\nana@empresa.com.br,Ana\nbeto@firma.com.br,Beto\n");
    expect(headers).toEqual(["Email", "Nome"]);
    expect(rows).toEqual([
      ["ana@empresa.com.br", "Ana"],
      ["beto@firma.com.br", "Beto"],
    ]);
  });

  it("autodetecta ponto e vírgula (export do Excel pt-BR)", () => {
    const { headers, rows } = parseCsv("Email;Nome;Empresa\nana@x.com.br;Ana;Empresa X\n");
    expect(headers).toEqual(["Email", "Nome", "Empresa"]);
    expect(rows).toEqual([["ana@x.com.br", "Ana", "Empresa X"]]);
  });

  it("respeita aspas: delimitador, quebras de linha e aspas escapadas dentro do campo", () => {
    const csv = 'Nome,Empresa,Notas\n"Souza, Ana","Dizem ""X""","linha 1\nlinha 2"\n';
    const { rows } = parseCsv(csv);
    expect(rows).toEqual([["Souza, Ana", 'Dizem "X"', "linha 1\nlinha 2"]]);
  });

  it("com aspas, a autodetecção não conta o delimitador de dentro do campo", () => {
    const csv = '"Sobrenome, Nome";Email\n"Souza, Ana";ana@x.com.br\n';
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["Sobrenome, Nome", "Email"]);
    expect(rows).toEqual([["Souza, Ana", "ana@x.com.br"]]);
  });

  it("remove BOM UTF-8, aceita CRLF e Buffer, e ignora linhas vazias", () => {
    const buffer = Buffer.from("\uFEFFEmail,Nome\r\n\r\nana@x.com.br,Ana\r\n,,\r\n", "utf8");
    const { headers, rows } = parseCsv(buffer);
    expect(headers).toEqual(["Email", "Nome"]);
    expect(rows).toEqual([["ana@x.com.br", "Ana"]]);
  });

  it("falha com mensagem clara em aspas sem fechamento e em arquivo vazio", () => {
    expect(() => parseCsv('a,b\n"aberto,x\n')).toThrow(/aspas/i);
    expect(() => parseCsv("\n\n")).toThrow(/vazio/i);
  });
});

// ─── Helper: monta um .xlsx mínimo em memória (ZIP stored/deflate + CRC32) ───

/** CRC32 (polinômio refletido 0xEDB88320) — implementado aqui para não depender de zlib.crc32 (Node ≥ 20.15). */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i] as number;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipFile {
  name: string;
  data: string;
  /** true → método 8 (deflate); default método 0 (stored). */
  deflate?: boolean;
}

function buildZip(files: ZipFile[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const content = Buffer.from(file.data, "utf8");
    const method = file.deflate ? 8 : 0;
    const payload = file.deflate ? deflateRawSync(content) : content;
    const crc = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // assinatura do cabeçalho local
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(0, 12); // data
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra
    chunks.push(local, nameBuf, payload);

    const cdir = Buffer.alloc(46);
    cdir.writeUInt32LE(0x02014b50, 0); // assinatura do diretório central
    cdir.writeUInt16LE(20, 4); // criado por
    cdir.writeUInt16LE(20, 6); // versão necessária
    cdir.writeUInt16LE(0, 8); // flags
    cdir.writeUInt16LE(method, 10);
    cdir.writeUInt16LE(0, 12); // hora
    cdir.writeUInt16LE(0, 14); // data
    cdir.writeUInt32LE(crc, 16);
    cdir.writeUInt32LE(payload.length, 20);
    cdir.writeUInt32LE(content.length, 24);
    cdir.writeUInt16LE(nameBuf.length, 28);
    cdir.writeUInt16LE(0, 30); // extra
    cdir.writeUInt16LE(0, 32); // comentário
    cdir.writeUInt16LE(0, 34); // disco
    cdir.writeUInt16LE(0, 36); // attrs internos
    cdir.writeUInt32LE(0, 38); // attrs externos
    cdir.writeUInt32LE(offset, 42); // offset do cabeçalho local
    central.push(Buffer.concat([cdir, nameBuf]));

    offset += 30 + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of Central Directory
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Contatos" sheetId="1" r:id="rId1"/><sheet name="Extra" sheetId="2" r:id="rId2"/></sheets></workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

// 0..2: cabeçalhos · 3: e-mail · 4: runs com entidades (&amp; &lt; &gt;)
const SHARED_STRINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5" uniqueCount="5"><si><t>Email</t></si><si><t>Nome</t></si><si><t>Empresa</t></si><si><t>ana@empresa.com.br</t></si><si><r><t>P&amp;G </t></r><r><t>&lt;Brasil&gt;</t></r></si></sst>`;

// linha 1: shared strings + t="str" · linha 2: shared/inlineStr(preserve)/numérica · linha 3: colunas puladas
const SHEET1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="str"><v>Score</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="inlineStr"><is><t xml:space="preserve">Ana </t></is></c><c r="C2" t="s"><v>4</v></c><c r="D2"><v>42.5</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>beto&#39;s@firma.com.br</t></is></c><c r="D3"><v>7</v></c></row><row r="4"/></sheetData></worksheet>`;

const SHEET2 = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>errada</t></is></c></row></sheetData></worksheet>`;

function xlsxFixture(deflate: boolean): Buffer {
  return buildZip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES, deflate },
    { name: "xl/workbook.xml", data: WORKBOOK, deflate },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS, deflate },
    { name: "xl/sharedStrings.xml", data: SHARED_STRINGS, deflate },
    { name: "xl/worksheets/sheet1.xml", data: SHEET1, deflate },
    { name: "xl/worksheets/sheet2.xml", data: SHEET2, deflate },
  ]);
}

// ─── parseXlsx ───────────────────────────────────────────────────────────────

describe("parseXlsx", () => {
  const expected = {
    headers: ["Email", "Nome", "Empresa", "Score"],
    rows: [
      ["ana@empresa.com.br", "Ana ", "P&G <Brasil>", "42.5"],
      ["beto's@firma.com.br", "", "", "7"],
    ],
  };

  it("lê ZIP com entradas STORED: primeira sheet via rels, sharedStrings, inlineStr, numéricas, entidades e colunas puladas", () => {
    expect(parseXlsx(xlsxFixture(false))).toEqual(expected);
  });

  it("lê ZIP com entradas DEFLATE (método 8)", () => {
    expect(parseXlsx(xlsxFixture(true))).toEqual(expected);
  });

  it("resolve a sheet pelo r:id do workbook, não pela ordem dos relationships", () => {
    // WORKBOOK_RELS declara rId2 (sheet2, "errada") antes de rId1 (sheet1)
    const { rows } = parseXlsx(xlsxFixture(false));
    expect(rows.flat()).not.toContain("errada");
  });

  it("falha com sugestão de exportar CSV quando o arquivo não é um ZIP", () => {
    expect(() => parseXlsx(Buffer.from("isto não é um arquivo xlsx de verdade"))).toThrow(/CSV/);
  });

  it("falha com mensagem clara quando o ZIP não tem xl/workbook.xml", () => {
    const zip = buildZip([{ name: "[Content_Types].xml", data: CONTENT_TYPES }]);
    expect(() => parseXlsx(zip)).toThrow(/workbook/);
  });
});
