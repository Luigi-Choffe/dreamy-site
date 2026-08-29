import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { presetConsent } from "./helpers";

/**
 * Console de outbound (`/interno/outbound`) em modo demonstração (`?demo=1`).
 * O seed (`pnpm outbound:demo`) é determinístico (PRNG com seed fixa) e povoa
 * `.outbound-demo/` — o store real (`.outbound/`) nunca é tocado. O teste de
 * mutação (pausar campanha) só altera o store de demo; o seed do próximo run
 * reseta tudo.
 */

// Mantém os testes deste arquivo em ordem no mesmo worker (por projeto): o seed do
// beforeAll roda uma vez por worker e o teste de mutação fica por último.
test.describe.configure({ mode: "default" });

const CAMPAIGN_SLUGS = ["exemplo-nova-receita", "exemplo-sistemas", "exemplo-agentes"];

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .disableRules(["region"]) // mesmo critério do a11y.spec (landmarks cobertos manualmente)
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
}

test.describe("Console de outbound — modo demonstração (?demo=1)", () => {
  test.beforeAll(() => {
    // Seed determinístico do store de demo (idempotente; serializado por lockfile).
    // Guarda de frescor: se o OUTRO projeto (desktop/mobile) acabou de semear, NÃO
    // re-semear — um reseed no meio dos testes dele desfaria a mutação de pausa
    // (achado da revisão: corrida entre projetos sobre o .outbound-demo compartilhado).
    try {
      const mtime = statSync(path.join(process.cwd(), ".outbound-demo", "contacts.json")).mtimeMs;
      if (Date.now() - mtime < 10 * 60_000) return;
    } catch {
      // sem seed ainda — segue para semear
    }
    const result = spawnSync("pnpm", ["tsx", "scripts/outbound/demo.ts"], {
      shell: process.platform === "win32",
      encoding: "utf8",
      timeout: 120_000,
    });
    if (result.status !== 0) {
      throw new Error(`seed do demo falhou (exit ${result.status}):\n${result.stderr || result.stdout}`);
    }
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await presetConsent(context, baseURL!);
  });

  test("visão geral: banner de demonstração e cards das 3 campanhas", async ({ page }) => {
    await page.goto("/interno/outbound?demo=1");
    await expect(page.getByRole("link", { name: "Sair do modo demo" })).toBeVisible();
    for (const slug of CAMPAIGN_SLUGS) {
      // Navegação interna preserva ?demo=1 (consoleHref)
      await expect(page.locator(`a[href^="/interno/outbound/${slug}"]`).first()).toBeVisible();
      expect(await page.locator(`a[href^="/interno/outbound/${slug}"]`).first().getAttribute("href")).toContain(
        "demo=1",
      );
    }
  });

  test("detalhe da campanha: prévia da copy (assunto do e1) e funil por passo", async ({ page }) => {
    await page.goto("/interno/outbound/exemplo-sistemas?demo=1");
    await expect(page.getByRole("link", { name: "Sair do modo demo" })).toBeVisible();
    // Assunto do e1 de exemplo-sistemas ("pedidos em planilha na {{empresa}}?") —
    // vale tanto para prévia crua quanto renderizada com contato de amostra.
    await expect(page.getByText("pedidos em planilha na").first()).toBeVisible();
    // Funil por passo (rótulos do StepFunnel de ui.tsx)
    await expect(page.getByText("Planejados").first()).toBeVisible();
    await expect(page.getByText("Entregues").first()).toBeVisible();
  });

  test("contatos: busca filtra por empresa", async ({ page }) => {
    await page.goto("/interno/outbound/contatos?demo=1");
    const search = page.locator('input[type="search"], input[name="q"], input[name="busca"]').first();
    if ((await search.count()) > 0) {
      await search.fill("Empresa Demo 01");
      await search.press("Enter");
    } else {
      // fallback: busca via query string (form GET)
      await page.goto("/interno/outbound/contatos?demo=1&q=Empresa+Demo+01");
    }
    await expect(page.getByText("Ana Demo 01").first()).toBeVisible();
    await expect(page.getByText("Empresa Demo 02")).toHaveCount(0);
  });

  test("respostas: há interessados no demo", async ({ page }) => {
    await page.goto("/interno/outbound/respostas?demo=1");
    await expect(page.getByText("interessado").first()).toBeVisible();
  });

  test("axe sem violações sérias/críticas na visão geral", async ({ page }) => {
    await page.goto("/interno/outbound?demo=1");
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolations(page);
  });

  test("axe sem violações sérias/críticas no detalhe da campanha", async ({ page }) => {
    await page.goto("/interno/outbound/exemplo-sistemas?demo=1");
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolations(page);
  });

  // Única mutação testada no e2e — ação conservadora sobre o store de DEMO
  // (o hidden name="demo" garante isso); o seed do próximo run reseta a pausa.
  // Cada projeto pausa uma campanha DIFERENTE (o store é compartilhado e o seed
  // não re-roda entre projetos — guarda de frescor acima).
  test("pausar campanha aprovada pelo console muda o status para pausada", async ({ page }, testInfo) => {
    const slug = testInfo.project.name.includes("mobile") ? "exemplo-sistemas" : "exemplo-nova-receita";
    await page.goto(`/interno/outbound/${slug}?demo=1`);
    await expect(page.getByText("aprovada").first()).toBeVisible();
    // Auto-reparo: um run anterior (<10 min, seed pulado pela guarda de frescor)
    // pode ter deixado a campanha pausada — retoma antes de testar a pausa.
    const resumeButton = page.getByRole("button", { name: /retomar/i });
    if ((await resumeButton.count()) > 0) {
      await resumeButton.first().click();
      await expect(page.getByRole("button", { name: /pausar/i }).first()).toBeVisible({ timeout: 15_000 });
    }
    await page
      .getByRole("button", { name: /pausar/i })
      .first()
      .click();
    await expect(page.getByText("pausada").first()).toBeVisible({ timeout: 15_000 });
  });
});
