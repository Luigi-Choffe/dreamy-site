// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  usePathname: () => "/contato",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { LeadForm } from "@/components/forms/LeadForm";

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome"), "Ana Souza");
  await user.type(screen.getByLabelText("Empresa"), "Empresa X");
  await user.type(screen.getByLabelText("Cargo"), "CEO");
  await user.type(screen.getByLabelText("E-mail"), "ana@empresax.com.br");
  await user.type(screen.getByLabelText("WhatsApp / telefone"), "11999998888");
}

describe("<LeadForm />", () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.sessionStorage.clear();
  });

  it("valida a etapa 1 e mostra erros acessíveis sem avançar", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    const name = screen.getByLabelText("Nome");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", expect.stringContaining("name-error"));
    // ainda na etapa 1
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(window.dataLayer!.some((e) => (e as { event: string }).event === "form_error")).toBe(true);
  });

  it("avança para a etapa 2, envia e mostra sucesso com generate_lead sem PII", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, requestId: "r", leadBucket: "alta", urgencyBucket: "ate_30d", solution: "sistema" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    render(<LeadForm />);
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(window.dataLayer!.some((e) => (e as { event: string }).event === "form_step_complete")).toBe(true);

    await user.click(screen.getByLabelText("Preciso desenvolver um sistema"));
    await user.type(
      screen.getByLabelText("Qual problema ou oportunidade você quer resolver?"),
      "Nossa operação depende de planilhas paralelas e o cadastro de clientes é manual.",
    );
    await user.click(screen.getByLabelText("Próximos 30 dias"));
    await user.click(screen.getByLabelText(/Li e concordo com a/));
    await user.click(screen.getByRole("button", { name: "Enviar contexto" }));

    expect(await screen.findByRole("heading", { name: "Recebemos seu contexto." })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.submissionId).toMatch(/[0-9a-f-]{36}/);
    expect(body.website).toBe("");
    expect(body.consent).toBe(true);

    const lead = window.dataLayer!.find((e) => (e as { event: string }).event === "generate_lead") as Record<
      string,
      unknown
    >;
    expect(lead).toMatchObject({ solution: "sistema", lead_bucket: "alta", urgency_bucket: "ate_30d" });
    expect(JSON.stringify(window.dataLayer)).not.toContain("ana@empresax.com.br");
  });

  it("erro do servidor mantém os campos e oferece retry; double-submit é bloqueado", async () => {
    const user = userEvent.setup();
    let resolveFetch: (r: Response) => void = () => {};
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    render(<LeadForm />);
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByLabelText("Quero aplicar IA na empresa"));
    await user.type(
      screen.getByLabelText("Qual problema ou oportunidade você quer resolver?"),
      "Queremos usar IA no atendimento para qualificar leads.",
    );
    await user.click(screen.getByLabelText("Agora"));
    await user.click(screen.getByLabelText(/Li e concordo com a/));

    const submit = screen.getByRole("button", { name: "Enviar contexto" });
    await user.click(submit);
    await user.click(submit); // segundo clique durante o envio
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();

    resolveFetch(new Response(JSON.stringify({ ok: false, code: "server_error", requestId: "r" }), { status: 500 }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Não conseguimos registrar seu contato agora/),
    );
    expect(screen.getByLabelText("Qual problema ou oportunidade você quer resolver?")).toHaveValue(
      "Queremos usar IA no atendimento para qualificar leads.",
    );
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("erro de rede mostra mensagem específica", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LeadForm />);
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByLabelText("Outro"));
    await user.type(
      screen.getByLabelText("Qual problema ou oportunidade você quer resolver?"),
      "Descrição suficientemente longa para validar.",
    );
    await user.click(screen.getByLabelText("Apenas pesquisando"));
    await user.click(screen.getByLabelText(/Li e concordo com a/));
    await user.click(screen.getByRole("button", { name: "Enviar contexto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sem conexão com o servidor/);
  });
});
