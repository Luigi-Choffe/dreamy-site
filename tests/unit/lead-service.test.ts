import { describe, expect, it, vi } from "vitest";
import type { CRMProvider } from "@/lib/crm";
import type { NotificationProvider } from "@/lib/email";
import { renderLeadEmail } from "@/lib/email";
import { leadInputSchema } from "@/lib/leads/schema";
import { buildLeadRecord, createLeadService } from "@/lib/leads/service";
import type { LeadStore } from "@/lib/leads/store";
import { createMemoryIdempotencyStore } from "@/lib/security/idempotency";
import { createMemoryRateLimiter } from "@/lib/security/rate-limit";

const input = leadInputSchema.parse({
  name: "Ana Souza",
  company: "Empresa X",
  role: "Diretora de Operações",
  email: "ana@empresax.com.br",
  phone: "(11) 99999-8888",
  need: "sistema",
  description: "Nossa operação depende de planilhas paralelas e o cadastro de clientes é manual e demorado.",
  urgency: "30-dias",
  investment: "50-100k",
  consent: true,
  submissionId: "3f0f6f5e-3a37-4a2f-9a68-1c1c1c1c1c1c",
  page: "/contato",
  attribution: {
    utm_source: "linkedin",
    utm_medium: "social",
    landing_page: "/",
    referrer: "https://www.linkedin.com/",
  },
});

const noopStore: LeadStore = { name: "none", save: async () => false };
const okCrm: CRMProvider = { name: "webhook", send: vi.fn(async () => {}) };
const failCrm: CRMProvider = {
  name: "webhook",
  send: vi.fn(async () => {
    throw new Error("boom");
  }),
};
const okMail: NotificationProvider = { name: "resend", notifyNewLead: vi.fn(async () => {}) };
const failMail: NotificationProvider = {
  name: "resend",
  notifyNewLead: vi.fn(async () => {
    throw new Error("smtp");
  }),
};
const noneCrm: CRMProvider = { name: "none", send: async () => {} };
const noneMail: NotificationProvider = { name: "none", notifyNewLead: async () => {} };

describe("buildLeadRecord (PRD §40)", () => {
  it("transforma input em registro completo com score, buckets, UTMs e telefone normalizado", () => {
    const rec = buildLeadRecord(input, { requestId: "req-1", now: new Date("2026-08-17T12:00:00Z"), id: "lead-1" });
    expect(rec).toMatchObject({
      lead_id: "lead-1",
      created_at: "2026-08-17T12:00:00.000Z",
      nome: "Ana Souza",
      email: "ana@empresax.com.br",
      telefone: "5511999998888",
      empresa: "Empresa X",
      cargo: "Diretora de Operações",
      necessidade: "sistema",
      urgencia: "30-dias",
      investimento: "50-100k",
      lead_score: 85, // executivo + e-mail corporativo + urgência ≤ 90 d + investimento ≥ 20 mil + solução identificada (descrição < 120 chars)
      lead_bucket: "alta",
      urgency_bucket: "ate_30d",
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: null,
      landing_page: "/",
      referrer: "https://www.linkedin.com/",
      page: "/contato",
      source: "website",
    });
  });
});

describe("LeadService (PRD §41–§42)", () => {
  it("entrega ao CRM e notifica; falha de e-mail não destrói lead entregue ao CRM", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const svc = createLeadService({ crm: okCrm, notifier: failMail, store: noopStore });
    const { delivery } = await svc.process(input, "req");
    expect(delivery.crm).toBe("ok");
    expect(delivery.notification).toBe("failed");
  });

  it("falha do CRM é observável e o e-mail ainda entrega", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const svc = createLeadService({ crm: failCrm, notifier: okMail, store: noopStore });
    const { delivery } = await svc.process(input, "req");
    expect(delivery.crm).toBe("failed");
    expect(delivery.notification).toBe("ok");
    expect(err).toHaveBeenCalled();
    expect(err.mock.calls.some((c) => String(c[0]).includes("lead.crm_failed"))).toBe(true);
  });

  it("sem nenhum provider configurado: skipped (não é erro)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const svc = createLeadService({ crm: noneCrm, notifier: noneMail, store: noopStore });
    const { delivery } = await svc.process(input, "req");
    expect(delivery.crm).toBe("skipped");
    expect(delivery.notification).toBe("skipped");
  });

  it("todas as entregas falham → log de recuperação com o lead completo", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const svc = createLeadService({ crm: failCrm, notifier: failMail, store: noopStore });
    await svc.process(input, "req");
    expect(err.mock.calls.some((c) => String(c[0]).includes("lead.delivery_failed_all"))).toBe(true);
  });
});

describe("e-mail de notificação", () => {
  it("assunto traz prioridade, empresa e nome; corpo escapa HTML", () => {
    const rec = buildLeadRecord(
      { ...input, description: "<script>alert(1)</script> teste" },
      { requestId: "r", id: "l" },
    );
    const mail = renderLeadEmail(rec);
    expect(mail.subject).toContain("[Lead ALTA] Empresa X — Ana Souza");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain("WhatsApp/telefone: +5511999998888");
  });
});

describe("rate limit e idempotência", () => {
  it("bloqueia após o limite e libera com o tempo", async () => {
    let t = 0;
    const rl = createMemoryRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect((await rl.check("ip")).allowed).toBe(true);
    expect((await rl.check("ip")).allowed).toBe(true);
    const third = await rl.check("ip");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
    t = 1500;
    expect((await rl.check("ip")).allowed).toBe(true);
  });

  it("idempotência devolve resposta anterior e expira após TTL", async () => {
    let t = 0;
    const store = createMemoryIdempotencyStore<{ ok: boolean }>(1000, () => t);
    expect(await store.reserve("a")).toBe(true);
    expect(await store.reserve("a")).toBe(false);
    await store.set("a", { ok: true });
    expect(await store.get("a")).toEqual({ ok: true });
    expect(await store.reserve("a")).toBe(true); // liberado após set
    t = 2000;
    expect(await store.get("a")).toBeUndefined();
  });

  it("reserva 'em andamento' expira sozinha (instância que morreu no meio)", async () => {
    let t = 0;
    const store = createMemoryIdempotencyStore<{ ok: boolean }>(10 * 60 * 1000, () => t);
    expect(await store.reserve("b")).toBe(true);
    t = 61_000;
    expect(await store.reserve("b")).toBe(true);
  });
});
