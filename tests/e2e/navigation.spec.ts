import { expect, test } from "@playwright/test";
import { presetConsent } from "./helpers";

test.describe("Navegação (PRD §89)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await presetConsent(context, baseURL!);
  });

  test("Home → Solution → Contact (CTAs corretos e ?solucao= preservado)", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tecnologia sob medida");

    if (isMobile) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Agentes de IA" }).click();
    } else {
      await page.getByRole("button", { name: "Soluções" }).click();
      await page
        .getByRole("link", { name: /Agentes de IA/ })
        .first()
        .click();
    }
    await expect(page).toHaveURL(/\/solucoes\/agentes-de-ia$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Coloque a IA para executar trabalho dentro da sua empresa.",
    );

    await page.getByRole("link", { name: "Encontrar uma aplicação para IA" }).first().click();
    await expect(page).toHaveURL(/\/contato\?solucao=agente-ia$/);
    await page.getByRole("button", { name: "Continuar" }).waitFor();
  });

  test("Mobile Menu: abre, fecha com ESC e é acessível", async ({ page, isMobile }) => {
    test.skip(!isMobile, "somente mobile");
    await page.goto("/");
    const open = page.getByRole("button", { name: "Abrir menu" });
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Agendar conversa" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toHaveAttribute("aria-expanded", "false");
  });

  test("Dropdown de Soluções por teclado (desktop)", async ({ page, isMobile }) => {
    test.skip(isMobile, "somente desktop");
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Soluções" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: /Nova Receita Digital/ }).first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("404: página própria com CTAs", async ({ page }) => {
    const res = await page.goto("/uma-pagina-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parece que esta página não existe.");
    await expect(page.getByRole("link", { name: "Voltar para a Dreamy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Conhecer nossas soluções" })).toBeVisible();
  });

  test("Skip link e um único H1 por página", async ({ page }) => {
    for (const path of ["/", "/solucoes", "/sobre", "/contato", "/privacidade", "/cookies"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
    }
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  });

  test("Cases e Insights ficam ocultos sem conteúdo aprovado (gates)", async ({ page }) => {
    const cases = await page.goto("/cases");
    expect(cases?.status()).toBe(404);
    const insights = await page.goto("/insights");
    expect(insights?.status()).toBe(404);
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Cases" }),
    ).toHaveCount(0);
  });

  test("Consentimento: banner aparece sem cookie e Consent Mode default é denied", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(baseURL! + "/");
    await expect(page.getByRole("region", { name: "Cookies e privacidade" })).toBeVisible();
    const dl = await page.evaluate(() => (window as unknown as { dataLayer: unknown[] }).dataLayer);
    const consentDefault = (dl as Array<IArguments | Record<string, unknown>>).find(
      (e) => Array.isArray(e) || (typeof e === "object" && e !== null && (e as ArrayLike<unknown>)[0] === "consent"),
    ) as ArrayLike<unknown> | undefined;
    // o push é um objeto Arguments serializado como {0:'consent',1:'default',2:{...}}
    const entries = dl as Array<Record<string, unknown>>;
    const found = entries.find(
      (e) =>
        e && (e as Record<string, unknown>)["0"] === "consent" && (e as Record<string, unknown>)["1"] === "default",
    );
    expect(found ?? consentDefault).toBeTruthy();
    const params = (found as Record<string, unknown> | undefined)?.["2"] as Record<string, string> | undefined;
    expect(params?.analytics_storage).toBe("denied");
    expect(params?.ad_storage).toBe("denied");

    await page.getByRole("button", { name: "Aceitar todos" }).click();
    await expect(page.getByRole("region", { name: "Cookies e privacidade" })).toBeHidden();
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "dreamy_consent")).toBeTruthy();
    const dl2 = await page.evaluate(
      () => (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer,
    );
    expect(dl2.find((e) => e.event === "consent_update" && e.consent_analytics === true)).toBeTruthy();
    await context.close();
  });
});
