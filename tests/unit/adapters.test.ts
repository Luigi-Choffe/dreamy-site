import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebhookCrmProvider } from "@/lib/crm";
import { createResendProvider } from "@/lib/email";
import { buildLeadRecord } from "@/lib/leads/service";
import { leadInputSchema } from "@/lib/leads/schema";
import { buildCsp, buildSecurityHeaders } from "@/lib/security/headers";

const lead = buildLeadRecord(
  leadInputSchema.parse({
    name: "Ana",
    company: "Empresa",
    role: "CEO",
    email: "ana@empresa.com.br",
    phone: "11999998888",
    need: "sistema",
    description: "Descrição suficientemente longa para validar o schema.",
    urgency: "agora",
    consent: true,
    submissionId: "3f0f6f5e-3a37-4a2f-9a68-1c1c1c1c1c1c",
  }),
  { requestId: "req", id: "lead-1", now: new Date("2026-08-18T00:00:00Z") },
);

function mockFetchSequence(responses: Array<{ status: number; body?: string } | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return new Response(next.body ?? "", { status: next.status });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

describe("CRM webhook adapter (PRD §41–§42)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envia JSON com Authorization e request id", async () => {
    const { calls } = mockFetchSequence([{ status: 200 }]);
    const crm = createWebhookCrmProvider("https://crm.example/hook", "secret");
    await crm.send(lead, { requestId: "req-1" });
    expect(calls).toHaveLength(1);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer secret");
    expect(headers["x-request-id"]).toBe("req-1");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.type).toBe("lead.created");
    expect(body.lead.lead_id).toBe("lead-1");
    expect(body.lead.email).toBe("ana@empresa.com.br");
  });

  it("faz retry em 5xx/erro de rede e desiste após 3 tentativas", async () => {
    vi.useFakeTimers();
    const { fn } = mockFetchSequence([{ status: 503 }, new Error("ECONNRESET"), { status: 200 }]);
    const crm = createWebhookCrmProvider("https://crm.example/hook");
    const p = crm.send(lead, { requestId: "req" });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("não faz retry em 4xx (erro definitivo)", async () => {
    const { fn } = mockFetchSequence([{ status: 400, body: "bad" }]);
    const crm = createWebhookCrmProvider("https://crm.example/hook");
    await expect(crm.send(lead, { requestId: "req" })).rejects.toThrow(/HTTP 400/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("Resend adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envia para múltiplos destinatários com reply_to do lead e lança em erro HTTP", async () => {
    const { calls } = mockFetchSequence([{ status: 200 }, { status: 401, body: "unauthorized" }]);
    const mail = createResendProvider("key", "a@dreamy.app.br, b@dreamy.app.br", "Dreamy Site <leads@dreamy.app.br>");
    await mail.notifyNewLead(lead, { requestId: "req" });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.to).toEqual(["a@dreamy.app.br", "b@dreamy.app.br"]);
    expect(body.reply_to).toBe("ana@empresa.com.br");
    expect(body.subject).toContain("Empresa");
    await expect(mail.notifyNewLead(lead, { requestId: "req" })).rejects.toThrow(/401/);
  });
});

describe("Security headers (PRD §76)", () => {
  it("Report-Only por padrão, enforce sob demanda; HSTS só em produção; noindex fora de produção", () => {
    const preview = buildSecurityHeaders({ enforceCsp: false, isProduction: false });
    expect(preview.find((h) => h.key === "Content-Security-Policy-Report-Only")).toBeTruthy();
    expect(preview.find((h) => h.key === "Content-Security-Policy")).toBeUndefined();
    expect(preview.find((h) => h.key === "X-Robots-Tag")?.value).toContain("noindex");
    expect(preview.find((h) => h.key === "Strict-Transport-Security")).toBeUndefined();

    const prod = buildSecurityHeaders({ enforceCsp: true, isProduction: true });
    expect(prod.find((h) => h.key === "Content-Security-Policy")?.value).toContain("upgrade-insecure-requests");
    expect(prod.find((h) => h.key === "Strict-Transport-Security")).toBeTruthy();
    expect(prod.find((h) => h.key === "X-Robots-Tag")).toBeUndefined();
  });

  it("CSP permite GTM/GA4/Meta/LinkedIn/Turnstile e bloqueia object/base", () => {
    const csp = buildCsp({ enforceCsp: false });
    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://connect.facebook.net");
    expect(csp).toContain("https://snap.licdn.com");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
