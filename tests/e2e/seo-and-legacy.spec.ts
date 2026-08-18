import { expect, test } from "@playwright/test";
import { presetConsent } from "./helpers";

test.describe("SEO, migração e consentimento (PRD §45, §51, §53, §73)", () => {
  test("âncoras do site antigo redirecionam para as novas rotas", async ({ page, context, baseURL }) => {
    await presetConsent(context, baseURL!);
    await page.goto("/#form");
    await expect(page).toHaveURL(/\/contato$/);
    await page.goto("/#tools");
    await expect(page).toHaveURL(/\/solucoes$/);
    await page.goto("/#integrations");
    await expect(page).toHaveURL(/\/solucoes\/agentes-de-ia$/);
  });

  test("metadata essencial: title, description, canonical, OG, JSON-LD sem review", async ({
    page,
    context,
    baseURL,
  }) => {
    await presetConsent(context, baseURL!);
    await page.goto("/solucoes/agentes-de-ia");
    await expect(page).toHaveTitle("Agentes de IA para Empresas | Dreamy");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe("https://www.dreamy.app.br/solucoes/agentes-de-ia");
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toContain("Agentes de IA");
    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(ogImage).toMatch(/opengraph-image/);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const joined = jsonLd.join("\n");
    expect(joined).toContain('"@type":"Service"');
    expect(joined).toContain('"@type":"BreadcrumbList"');
    expect(joined).not.toMatch(/aggregateRating|"review"/i);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("fora de produção: robots bloqueia, sitemap vazio e meta noindex", async ({ request, page, baseURL }) => {
    const robots = await (await request.get(`${baseURL}/robots.txt`)).text();
    const sitemap = await (await request.get(`${baseURL}/sitemap.xml`)).text();
    const home = await request.get(`${baseURL}/`);
    const xRobots = home.headers()["x-robots-tag"];
    // ambos os cenários são válidos dependendo de NEXT_PUBLIC_SITE_ENV usado no build
    const isProdBuild = /Allow: \//.test(robots) && !/Disallow: \/\s*$/m.test(robots);
    if (isProdBuild) {
      expect(sitemap).toContain("<loc>https://www.dreamy.app.br/</loc>");
      expect(sitemap).not.toContain("/cases");
      expect(sitemap).not.toContain("/insights");
    } else {
      expect(robots).toMatch(/Disallow: \//);
      expect(sitemap).not.toContain("<loc>");
      expect(xRobots).toContain("noindex");
      await page.goto("/");
      const meta = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(meta).toContain("noindex");
    }
  });

  test("preferências de cookies podem ser reabertas e alteradas depois", async ({ page, context, baseURL }) => {
    await presetConsent(context, baseURL!, false);
    await page.goto("/cookies");
    await expect(page.getByRole("region", { name: "Cookies e privacidade" })).toHaveCount(0);
    await page.getByRole("button", { name: "Abrir preferências de cookies" }).click();
    const dialog = page.getByRole("dialog", { name: "Preferências de cookies" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Análise/).check();
    await dialog.getByRole("button", { name: "Salvar preferências" }).click();
    await expect(dialog).toBeHidden();
    const cookie = (await context.cookies()).find((c) => c.name === "dreamy_consent");
    expect(cookie).toBeTruthy();
    const value = JSON.parse(decodeURIComponent(cookie!.value));
    expect(value.analytics).toBe(true);
    expect(value.marketing).toBe(false);
    const dl = await page.evaluate(
      () => (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer,
    );
    expect(dl.find((e) => e.event === "consent_update" && e.consent_analytics === true)).toBeTruthy();
  });

  test("UTMs são capturadas e enviadas com o lead", async ({ page, context, baseURL }) => {
    await presetConsent(context, baseURL!);
    let sentBody: Record<string, unknown> | null = null;
    await page.route("**/api/leads", async (route) => {
      sentBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "r",
          leadBucket: "media",
          urgencyBucket: "1_3m",
          solution: "outro",
        }),
      });
    });
    await page.goto("/solucoes?utm_source=linkedin&utm_medium=social&utm_campaign=lancamento");
    await page.getByRole("link", { name: "Conversar com a Dreamy" }).first().click();
    await expect(page).toHaveURL(/\/contato/);
    await page.getByLabel("Nome", { exact: true }).fill("Teste UTM");
    await page.getByLabel("Empresa", { exact: true }).fill("Empresa");
    await page.getByLabel("Cargo", { exact: true }).fill("Diretor");
    await page.getByLabel("E-mail", { exact: true }).fill("t@empresa.com.br");
    await page.getByLabel("WhatsApp / telefone", { exact: true }).fill("11999998888");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Outro").check();
    await page
      .getByLabel("Qual problema ou oportunidade você quer resolver?")
      .fill("Descrição de teste suficientemente longa.");
    await page.getByLabel("1–3 meses").check();
    await page.getByLabel(/Li e concordo com a/).check();
    await page.getByRole("button", { name: "Enviar contexto" }).click();
    await expect(page.getByRole("heading", { name: "Recebemos seu contexto." })).toBeVisible();
    expect(sentBody).toBeTruthy();
    const attribution = (sentBody as unknown as { attribution: Record<string, string> }).attribution;
    expect(attribution.utm_source).toBe("linkedin");
    expect(attribution.utm_campaign).toBe("lancamento");
    expect(attribution.landing_page).toContain("/solucoes?utm_source=linkedin");
  });

  test("header: CTA visível no mobile e oculto na própria página de contato", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await presetConsent(context, baseURL!);
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: isMobile ? "Agendar" : "Agendar conversa" })).toBeVisible();
    await page.goto("/contato");
    await expect(header.getByRole("link", { name: /Agendar/ })).toHaveCount(0);
  });
});
