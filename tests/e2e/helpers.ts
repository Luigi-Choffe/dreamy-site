import type { BrowserContext, Page } from "@playwright/test";

/** Pré-define o consentimento para os testes não serem cobertos pelo banner. */
export async function presetConsent(context: BrowserContext, baseURL: string, analytics = false) {
  await context.addCookies([
    {
      name: "dreamy_consent",
      value: encodeURIComponent(JSON.stringify({ v: 1, analytics, marketing: false, t: 1 })),
      url: baseURL,
    },
  ]);
}

export async function fillStep1(
  page: Page,
  overrides: Partial<Record<"name" | "company" | "role" | "email" | "phone", string>> = {},
) {
  await page.getByLabel("Nome", { exact: true }).fill(overrides.name ?? "Teste Automatizado");
  await page.getByLabel("Empresa", { exact: true }).fill(overrides.company ?? "Empresa Teste");
  await page.getByLabel("Cargo", { exact: true }).fill(overrides.role ?? "Diretor de Operações");
  await page.getByLabel("E-mail", { exact: true }).fill(overrides.email ?? "teste@empresateste.com.br");
  await page.getByLabel("WhatsApp / telefone", { exact: true }).fill(overrides.phone ?? "(11) 99999-8888");
}

export async function fillStep2(page: Page) {
  await page.getByLabel("Preciso desenvolver um sistema").check();
  await page
    .getByLabel("Qual problema ou oportunidade você quer resolver?")
    .fill(
      "Nossa operação depende de planilhas paralelas e o cadastro de clientes é manual. Queremos centralizar as informações.",
    );
  await page.getByLabel("Próximos 30 dias").check();
  await page.getByLabel("Existe uma faixa de investimento prevista?").selectOption("50-100k");
  await page.getByLabel(/Li e concordo com a/).check();
}

/** Lê o dataLayer da página. */
export async function readDataLayer(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => (window as unknown as { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []);
}
