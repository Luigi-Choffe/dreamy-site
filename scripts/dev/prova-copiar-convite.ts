/**
 * Prova de ponta a ponta do "Copiar e abrir" do Hoje: abre a fila real (dev com
 * OUTBOUND_AUTH_DISABLED), clica no botão da 1ª e da 2ª linha e lê a área de
 * transferência. Imprime só o primeiro nome esperado e o texto copiado.
 * Uso: pnpm tsx scripts/dev/prova-copiar-convite.ts [base=http://localhost:3478]
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3478";

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await page.goto(`${base}/interno/outbound/hoje`, { waitUntil: "networkidle", timeout: 120_000 });
  const linhas = page.locator('ol li:has(button:has-text("Copiar e abrir"))');
  const total = await linhas.count();
  console.log(`linhas com o botão: ${total}`);
  for (const i of [0, 1]) {
    const linha = linhas.nth(i);
    const nomeCompleto = (await linha.locator("a[title]").first().getAttribute("title")) ?? "";
    const [popup] = await Promise.all([
      ctx.waitForEvent("page", { timeout: 15_000 }).catch(() => null),
      linha.getByRole("button", { name: /Copiar e abrir/ }).click(),
    ]);
    await page.waitForTimeout(500);
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    const primeiro = nomeCompleto.split(/\s+/)[0] ?? "";
    console.log(
      `linha ${i + 1}: lead "${primeiro}" · aba aberta: ${popup ? popup.url().includes("linkedin.com") : false}`,
    );
    console.log(`  copiado: ${copiado}`);
    console.log(
      `  tem o nome? ${copiado.includes(`Olá, ${primeiro.charAt(0).toUpperCase()}${primeiro.slice(1).toLowerCase()}!`)}`,
    );
    if (popup) await popup.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
