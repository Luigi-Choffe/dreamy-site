/**
 * Espelho da Visão geral do console (dados reais, dev com OUTBOUND_AUTH_DISABLED).
 * Uso: pnpm tsx scripts/dev/espelho-home.ts <pasta-saida> [base]
 */
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "docs/qa/outbound-console/espelho-home";
const base = process.argv[3] ?? "http://localhost:3477";

async function shot(width: number, height: number, name: string) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(`${base}/interno/outbound`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await b.close();
  console.log(`✓ ${name}`);
}

async function main() {
  await shot(1720, 1000, "home-1720");
  await shot(1280, 900, "home-1280");
  await shot(390, 844, "home-390");
}
main();
