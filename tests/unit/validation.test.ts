import { describe, expect, it } from "vitest";
import {
  cleanMultiline,
  cleanText,
  fieldErrors,
  isValidBrPhone,
  leadInputSchema,
  normalizePhone,
} from "@/lib/leads/schema";

const valid = {
  name: "  Ana   Souza ",
  company: "Empresa X",
  role: "CEO",
  email: "ANA@Empresa.com.br",
  phone: "(11) 99999-8888",
  need: "sistema",
  description: "Nossa operação depende de planilhas paralelas e o cadastro é manual.",
  urgency: "30-dias",
  investment: "50-100k",
  consent: true,
  website: "",
  submissionId: "3f0f6f5e-3a37-4a2f-9a68-1c1c1c1c1c1c",
  startedAt: Date.now() - 10_000,
  page: "/contato",
  attribution: { utm_source: "linkedin", utm_medium: "social" },
};

describe("leadInputSchema (PRD §35–§37)", () => {
  it("aceita payload válido, normaliza texto e e-mail", () => {
    const r = leadInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Ana Souza");
      expect(r.data.email).toBe("ana@empresa.com.br");
      expect(r.data.investment).toBe("50-100k");
    }
  });

  it("não bloqueia provedores gratuitos de e-mail", () => {
    const r = leadInputSchema.safeParse({ ...valid, email: "ana@gmail.com" });
    expect(r.success).toBe(true);
  });

  it("rejeita e-mail inválido, telefone inválido e descrição curta com mensagens por campo", () => {
    const r = leadInputSchema.safeParse({ ...valid, email: "x", phone: "123", description: "curta" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.email).toMatch(/e-mail válido/);
      expect(errs.phone).toMatch(/telefone válido/);
      expect(errs.description).toMatch(/mínimo de 20/);
    }
  });

  it("exige consentimento, necessidade e urgência", () => {
    const r = leadInputSchema.safeParse({ ...valid, consent: false, need: "", urgency: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.consent).toBeTruthy();
      expect(errs.need).toBeTruthy();
      expect(errs.urgency).toBeTruthy();
    }
  });

  it("investimento é opcional", () => {
    const r = leadInputSchema.safeParse({ ...valid, investment: undefined });
    expect(r.success).toBe(true);
    const r2 = leadInputSchema.safeParse({ ...valid, investment: "" });
    expect(r2.success).toBe(true);
  });

  it("limita tamanho da descrição (3000)", () => {
    const r = leadInputSchema.safeParse({ ...valid, description: "a".repeat(3001) });
    expect(r.success).toBe(false);
  });

  it("exige submissionId uuid", () => {
    const r = leadInputSchema.safeParse({ ...valid, submissionId: "abc" });
    expect(r.success).toBe(false);
  });
});

describe("telefone BR", () => {
  it("normaliza para dígitos com DDI", () => {
    expect(normalizePhone("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizePhone("+55 11 99999-8888")).toBe("5511999998888");
    expect(normalizePhone("011 3333-4444")).toBe("551133334444");
  });
  it("valida DDD e quantidade de dígitos", () => {
    expect(isValidBrPhone("11 99999 8888")).toBe(true);
    expect(isValidBrPhone("(21) 3333-4444")).toBe(true);
    expect(isValidBrPhone("(01) 3333-4444")).toBe(false);
    expect(isValidBrPhone("99999")).toBe(false);
    expect(isValidBrPhone("+1 555 123 4567")).toBe(false);
  });
});

describe("sanitização", () => {
  it("remove caracteres de controle e espaços redundantes", () => {
    expect(cleanText("a\u0000b   c\u200b")).toBe("ab c");
    expect(cleanMultiline("linha1\r\n\r\n\r\n\r\nlinha2   x")).toBe("linha1\n\nlinha2 x");
  });
});
