/**
 * Verificação de integridade de conteúdo (PRD §2, §18, §83, §106):
 * - frontmatter de cases/insights válido (schemas Zod);
 * - cases aprovados precisam de approvalRef; métricas precisam de sourceRef registrado em docs/CONTENT-SOURCES.md;
 * - métricas/logos de prova públicos precisam de sourceRef registrado;
 * - termos proibidos no conteúdo público (NoCode/LowCode, depoimentos, consultoria gratuita, lorem ipsum, placeholders).
 *
 * Uso: pnpm content:check
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { caseFrontmatterSchema, insightFrontmatterSchema } from "../src/lib/content/schemas";
import { authorizedLogos, proofMetrics } from "../src/content/proof";

const root = process.cwd();
const problems: string[] = [];
const warnings: string[] = [];

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

function listMdx(dir: string) {
  const abs = path.join(root, "src", "content", dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .map((f) => path.join(abs, f));
}

const sources = fs.existsSync(path.join(root, "docs", "CONTENT-SOURCES.md"))
  ? read(path.join(root, "docs", "CONTENT-SOURCES.md"))
  : "";

function sourceApproved(ref: string): boolean {
  // procura o bloco do sourceRef e verifica "Approved for public website: yes" nas linhas seguintes
  const idx = sources.indexOf(ref);
  if (idx < 0) return false;
  const window = sources.slice(Math.max(0, idx - 800), idx + 800);
  return /Approved for public website:\s*yes/i.test(window) || /Approved:\s*yes/i.test(window);
}

/* -------------------------------- cases ---------------------------------- */
for (const file of listMdx("cases")) {
  const { data } = matter(read(file));
  const parsed = caseFrontmatterSchema.safeParse(data);
  const rel = path.relative(root, file);
  if (!parsed.success) {
    problems.push(
      `${rel}: frontmatter inválido — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
    continue;
  }
  const fm = parsed.data;
  if (fm.approved) {
    if (!fm.approvalRef) problems.push(`${rel}: approved=true sem approvalRef (registro da aprovação do cliente).`);
    for (const m of fm.metrics) {
      if (!sourceApproved(m.sourceRef))
        problems.push(`${rel}: métrica "${m.label}" (${m.sourceRef}) sem aprovação em docs/CONTENT-SOURCES.md.`);
    }
  }
}

/* ------------------------------- insights -------------------------------- */
for (const file of listMdx("insights")) {
  const { data } = matter(read(file));
  const parsed = insightFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    problems.push(
      `${path.relative(root, file)}: frontmatter inválido — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
}

/* --------------------------------- prova --------------------------------- */
for (const m of proofMetrics) {
  if (m.verified && !sourceApproved(m.sourceRef))
    problems.push(`proof.ts: métrica "${m.value} ${m.label}" verificada sem aprovação registrada (${m.sourceRef}).`);
}
for (const l of authorizedLogos) {
  if (l.authorized && !sourceApproved(l.sourceRef))
    problems.push(`proof.ts: logo "${l.name}" autorizado sem registro (${l.sourceRef}).`);
  if (l.authorized && !fs.existsSync(path.join(root, "public", l.src)))
    problems.push(`proof.ts: arquivo do logo não encontrado: ${l.src}`);
}

/* ------------------------- termos proibidos (PRD §2) ---------------------- */
const FORBIDDEN: Array<{ re: RegExp; why: string }> = [
  {
    re: /\b(no[- ]?code|low[- ]?code|bubble\.io)\b/i,
    why: "NoCode/LowCode não pode aparecer como posicionamento público (PRD §2)",
  },
  { re: /\b(depoimento|testemunh[oa]|testimonial)s?\b/i, why: "depoimentos são proibidos (PRD §2)" },
  { re: /consultoria gratuita/i, why: "não oferecer consultoria gratuita (PRD §2)" },
  { re: /lorem ipsum/i, why: "placeholder (PRD §106)" },
  { re: /\[(INSERIR|TODO|TBD|PLACEHOLDER)[^\]]*\]/i, why: "placeholder de conteúdo (PRD §106)" },
];
const contentDirs = ["src/content", "src/config", "src/app", "src/components"];
const ALLOWLIST_FILES = new Set([
  path.join("src", "content", "cases", "_TEMPLATE.mdx.example"),
  path.join("src", "content", "insights", "_TEMPLATE.mdx.example"),
]);
function walk(dir: string, out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mdx?|json)$/.test(entry.name)) out.push(p);
  }
  return out;
}
for (const dir of contentDirs) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = path.relative(root, file);
    if (ALLOWLIST_FILES.has(rel)) continue;
    const text = read(file);
    for (const { re, why } of FORBIDDEN) {
      const m = text.match(re);
      if (!m) continue;
      // permite menções explicitamente negativas/documentais (ex.: "sem depoimentos", "não usar NoCode") em comentários de código
      const line = text.split("\n").find((l) => re.test(l)) ?? "";
      const isComment = /^\s*(\/\/|\/\*|\*|#|<!--)/.test(line) || /\/\*\*|\*\//.test(line);
      const negative = /(sem|não|nunca|proib|removid|regra|PRD)/i.test(line);
      if (isComment || negative) {
        continue;
      }
      problems.push(`${rel}: "${m[0]}" — ${why}`);
    }
  }
}

/* --------------------------------- saída --------------------------------- */
if (warnings.length) {
  console.log("Avisos:");
  for (const w of warnings) console.log(" - " + w);
}
if (problems.length) {
  console.error(`\n✖ ${problems.length} problema(s) de conteúdo:`);
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}
console.log("✓ Conteúdo íntegro: schemas válidos, prova aprovada, sem termos proibidos ou placeholders.");
