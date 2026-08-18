import { expect, test } from "@playwright/test";
import { fillStep1, fillStep2, presetConsent, readDataLayer } from "./helpers";

test.describe("Fluxo de contato (PRD §89, §92)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await presetConsent(context, baseURL!);
  });

  test("Contact → Success: envia lead, mostra sucesso e dispara generate_lead sem PII", async ({ page }) => {
    // aguarda tempo mínimo de preenchimento (anti-bot) de forma natural
    await page.goto("/contato?solucao=sistema");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vamos entender o que vale a pena construir.");

    await fillStep1(page);
    await page.getByRole("button", { name: "Continuar" }).click();

    // pré-seleção via ?solucao=sistema
    await expect(page.getByLabel("Preciso desenvolver um sistema")).toBeChecked();
    await fillStep2(page);

    // garante > 3 s desde o form_start (MIN_FILL_TIME_MS)
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Enviar contexto" }).click();

    await expect(page.getByRole("heading", { name: "Recebemos seu contexto." })).toBeVisible({ timeout: 20_000 });

    const dl = await readDataLayer(page);
    const events = dl.map((e) => e.event);
    expect(events).toContain("form_start");
    expect(events).toContain("form_step_complete");
    expect(events).toContain("generate_lead");
    const lead = dl.find((e) => e.event === "generate_lead")!;
    expect(lead.solution).toBe("sistema");
    expect(["alta", "media", "avaliacao"]).toContain(lead.lead_bucket);
    expect(lead.urgency_bucket).toBe("ate_30d");
    // sem PII em nenhum evento
    const serialized = JSON.stringify(dl);
    expect(serialized).not.toContain("teste@empresateste.com.br");
    expect(serialized).not.toContain("Teste Automatizado");
    expect(serialized).not.toContain("99999");
  });

  test("Validation Error: campos vazios mostram mensagens, mantêm valores e focam o primeiro erro", async ({
    page,
  }) => {
    await page.goto("/contato");
    await page.getByLabel("Nome", { exact: true }).fill("Ana");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText("Informe o nome da empresa.")).toBeVisible();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Ana");
    await expect(page.getByLabel("Empresa", { exact: true })).toBeFocused();

    // e-mail inválido específico
    await fillStep1(page, { email: "nao-e-um-email" });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();

    const dl = await readDataLayer(page);
    const errors = dl.filter((e) => e.event === "form_error");
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) expect(e.error_type).toBe("validation");
  });

  test("Server error: mantém campos e permite retry", async ({ page }) => {
    await page.route("**/api/leads", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "server_error", requestId: "x" }),
      }),
    );
    await page.goto("/contato");
    await fillStep1(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillStep2(page);
    await page.getByRole("button", { name: "Enviar contexto" }).click();

    const alert = page.getByRole("alert").filter({ hasText: "Não conseguimos registrar seu contato agora" });
    await expect(alert).toBeVisible();
    await expect(page.getByLabel("Qual problema ou oportunidade você quer resolver?")).toHaveValue(
      /planilhas paralelas/,
    );
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  test("Honeypot preenchido → resposta silenciosa sem generate_lead", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/leads`, {
      data: { website: "http://spam.example", name: "x", submissionId: "00000000-0000-4000-8000-000000000000" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.solution).toBe("spam");
  });

  test("Payload inválido → 400 com erros por campo; payload gigante → 413", async ({ request, baseURL }) => {
    const bad = await request.post(`${baseURL}/api/leads`, { data: { name: "" } });
    expect(bad.status()).toBe(400);
    const body = await bad.json();
    expect(body.code).toBe("validation");
    expect(body.errors).toBeTruthy();

    const huge = await request.post(`${baseURL}/api/leads`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ description: "x".repeat(20_000) }),
    });
    expect(huge.status()).toBe(413);
  });
});
