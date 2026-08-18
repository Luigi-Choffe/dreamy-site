/**
 * Screenshots do formulário de contato (passo 2, erros e sucesso) — revisão visual (dev).
 * Uso: pnpm tsx scripts/dev/form-shots.ts <pasta-saida> [base=http://localhost:3100]
 */
import { chromium, devices } from "@playwright/test";

const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3100";

async function run(name: string, ctxOpts: Parameters<typeof chromium.launch>[0] & object) {
  const b = await chromium.launch();
  const ctx = await b.newContext(ctxOpts);
  await ctx.addCookies([
    {
      name: "dreamy_consent",
      value: encodeURIComponent(JSON.stringify({ v: 1, necessary: true, analytics: false, marketing: false })),
      url: base,
    },
  ]);
  const p = await ctx.newPage();
  await p.route("**/api/leads", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        requestId: "r",
        leadBucket: "alta",
        urgencyBucket: "ate_30d",
        solution: "sistema",
      }),
    }),
  );
  await p.goto(`${base}/contato`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${name}-errors.png`, fullPage: true });
  await p.getByLabel("Nome", { exact: true }).fill("Maria Silva");
  await p.getByLabel("Empresa", { exact: true }).fill("Empresa Exemplo");
  await p.getByLabel("Cargo", { exact: true }).fill("Diretora de Operações");
  await p.getByLabel("E-mail", { exact: true }).fill("maria@empresa.com.br");
  await p.getByLabel("WhatsApp / telefone", { exact: true }).fill("11999998888");
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${name}-step2.png`, fullPage: true });
  await p.getByLabel(/desenvolver um sistema/i).check();
  await p
    .getByLabel("Qual problema ou oportunidade você quer resolver?")
    .fill("Nossa operação depende de planilhas e os sistemas não conversam entre si.");
  await p.getByLabel("Agora", { exact: true }).check();
  await p.getByLabel(/Li e concordo com a/).check();
  await p.getByRole("button", { name: "Enviar contexto" }).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}-success.png`, fullPage: true });
  await b.close();
}

(async () => {
  await run("desktop", { viewport: { width: 1440, height: 900 } });
  await run("mobile", { ...devices["Pixel 7"] });
})();
