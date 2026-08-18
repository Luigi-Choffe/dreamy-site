import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { presetConsent } from "./helpers";

const ROUTES = [
  "/",
  "/solucoes",
  "/solucoes/nova-receita-digital",
  "/solucoes/sistemas-sob-medida",
  "/solucoes/agentes-de-ia",
  "/sobre",
  "/contato",
  "/privacidade",
  "/cookies",
  "/pagina-inexistente",
];

test.describe("Acessibilidade automatizada (PRD §65 — WCAG 2.2 AA)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await presetConsent(context, baseURL!);
  });

  for (const route of ROUTES) {
    test(`axe sem violações sérias/críticas em ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .disableRules(["region"]) // landmarks são cobertos manualmente; evita falso positivo em conteúdo decorativo
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious,
        JSON.stringify(
          serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          null,
          2,
        ),
      ).toEqual([]);
    });
  }

  test("formulário: erros anunciados e associados aos campos", async ({ page }) => {
    await page.goto("/contato");
    await page.getByRole("button", { name: "Continuar" }).click();
    const nameInput = page.getByLabel("Nome", { exact: true });
    await expect(nameInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = await nameInput.getAttribute("aria-describedby");
    expect(describedBy).toContain("name-error");
    await expect(page.locator("#name-error")).toHaveText(/Informe seu nome/);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
