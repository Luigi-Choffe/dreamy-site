import { readFileSync } from "node:fs";
import { listXlsxSheets, parseXlsx } from "../../src/lib/outbound/parse";
const file = process.argv[2] as string;
const buf = readFileSync(file);
const sheets = listXlsxSheets(buf);
console.log(`Abas (${sheets.length}):`);
sheets.forEach((name, i) => {
  const { headers, rows } = parseXlsx(buf, { sheet: i });
  const nonEmpty = headers.filter((h) => h.trim() !== "");
  console.log(`  [${i}] "${name}" — ${rows.length} linhas · ${nonEmpty.length} colunas: ${nonEmpty.slice(0, 12).join(" | ")}${nonEmpty.length > 12 ? " …" : ""}`);
});
