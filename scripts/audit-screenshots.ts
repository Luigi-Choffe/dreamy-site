/**
 * Captura screenshots (desktop + mobile) do site atual da Dreamy para a
 * auditoria da Fase 0 (PRD §1, §96). Saída: docs/audit/screenshots/.
 *
 * Uso: pnpm audit:screenshots [url]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const url = process.argv[2] ?? "https://www.dreamy.app.br/";
const outDir = path.resolve("docs/audit/screenshots");
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, isMobile: false },
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
];

async function main() {
  const browser = await chromium.launch();
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      deviceScaleFactor: vp.isMobile ? 2 : 1,
      locale: "pt-BR",
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    // Rola a página para disparar lazy-load / animações on-scroll
    await page.evaluate(async () => {
      const step = 600;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(outDir, `site-atual-${vp.name}-fold.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(outDir, `site-atual-${vp.name}-full.png`),
      fullPage: true,
    });
    console.log(`ok ${vp.name}`);
    await context.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
