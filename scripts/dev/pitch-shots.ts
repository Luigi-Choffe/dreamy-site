/**
 * Screenshots da apresentação viva (docs/apresentacao/dreamy-pitch.html) — revisão visual (dev).
 * Uso: pnpm tsx scripts/dev/pitch-shots.ts <pasta-saida> [espera-ms=2200]
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [outDir, waitArg] = process.argv.slice(2);
const settle = Number(waitArg) || 2200;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(pathToFileURL(path.resolve("docs/apresentacao/dreamy-pitch.html")).href, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getElementById("hint")!.remove());
  for (let i = 0; i < 12; i++) {
    await page.evaluate((n) => (window as unknown as { go: (i: number) => void }).go(n), i);
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `${outDir}/slide-${String(i + 1).padStart(2, "0")}.png` });
  }
  await browser.close();
  console.log("✓ 12 slides");
})();
