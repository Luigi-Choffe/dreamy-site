import { readFileSync } from "node:fs";
import { parseXlsx } from "../../src/lib/outbound/parse";
const { headers, rows } = parseXlsx(readFileSync(process.argv[2] as string));
console.log(`HEADERS (${headers.length}):`);
headers.forEach((h, i) => console.log(`  [${i}] ${JSON.stringify(h)}`));
console.log("LINHA 1 (e-mails mascarados):");
rows[0]?.forEach((v, i) => {
  let out = v;
  if (/@/.test(v)) out = v.replace(/^[^@]{2,}/, (m) => m[0] + "***");
  console.log(`  [${i}] ${JSON.stringify(out).slice(0, 100)}`);
});
console.log("total linhas:", rows.length);
