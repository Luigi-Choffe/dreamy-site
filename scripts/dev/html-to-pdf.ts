/**
 * Renderiza um HTML de slides (páginas 1280×720 via @page) em PDF com o Chromium do Playwright.
 * Uso: pnpm tsx scripts/dev/html-to-pdf.ts <arquivo.html> <saida.pdf>
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [htmlPath, pdfPath] = process.argv.slice(2);
if (!htmlPath || !pdfPath) {
  console.error("Uso: pnpm tsx scripts/dev/html-to-pdf.ts <arquivo.html> <saida.pdf>");
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.resolve(pdfPath),
    width: "1280px",
    height: "720px",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log(`✓ PDF gerado: ${pdfPath}`);
})();
