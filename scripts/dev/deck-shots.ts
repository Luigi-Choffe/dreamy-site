/**
 * Screenshots por slide de um HTML de apresentação (`.slide` 1280×720) — revisão visual (dev).
 * Uso: pnpm tsx scripts/dev/deck-shots.ts <arquivo.html> <pasta-saida>
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [htmlPath, outDir] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const slides = await page.locator(".slide").count();
  for (let i = 0; i < slides; i++) {
    await page
      .locator(".slide")
      .nth(i)
      .screenshot({ path: `${outDir}/slide-${String(i + 1).padStart(2, "0")}.png` });
  }
  await browser.close();
  console.log(`✓ ${slides} slides`);
})();
