import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSendReady, getOutboundEnv, parseReplyTo, replyToField } from "../../src/lib/outbound/config";
import type { OutboundEnv } from "../../src/lib/outbound/config";
import { createResendClient } from "../../src/lib/outbound/resend";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseReplyTo — OUTBOUND_REPLY_TO com um ou mais endereços", () => {
  it("um endereço (compatível com o formato antigo)", () => {
    expect(parseReplyTo("contact@bedreamy.com.br")).toEqual(["contact@bedreamy.com.br"]);
    expect(parseReplyTo("  contact@bedreamy.com.br  ")).toEqual(["contact@bedreamy.com.br"]);
  });

  it("dois endereços separados por vírgula, com espaços e vírgula sobrando", () => {
    expect(parseReplyTo("contact@bedreamy.com.br,  luigi.choffe@bedreamy.com.br ,")).toEqual([
      "contact@bedreamy.com.br",
      "luigi.choffe@bedreamy.com.br",
    ]);
  });

  it("ausente ou vazio → lista vazia (sem erro)", () => {
    expect(parseReplyTo(undefined)).toEqual([]);
    expect(parseReplyTo("")).toEqual([]);
    expect(parseReplyTo(" , ")).toEqual([]);
  });

  it("endereço inválido → erro acionável citando o valor ruim", () => {
    expect(() => parseReplyTo("contact@bedreamy.com.br, luigi.choffe")).toThrow(/inválido: "luigi.choffe"/);
    expect(() => parseReplyTo("Luigi <luigi@bedreamy.com.br>")).toThrow(/OUTBOUND_REPLY_TO/);
    expect(() => parseReplyTo("sem-arroba")).toThrow(/separados por vírgula/);
  });
});

describe("getOutboundEnv — replyTo (primeiro) e replyToAll (todos)", () => {
  it("dois endereços: replyTo é o primeiro, replyToAll mantém a ordem", () => {
    vi.stubEnv("OUTBOUND_REPLY_TO", "contact@bedreamy.com.br, luigi.choffe@bedreamy.com.br");
    const env = getOutboundEnv();
    expect(env.replyTo).toBe("contact@bedreamy.com.br");
    expect(env.replyToAll).toEqual(["contact@bedreamy.com.br", "luigi.choffe@bedreamy.com.br"]);
    expect(env.replyToError).toBeNull();
  });

  it("um endereço: comportamento idêntico ao anterior", () => {
    vi.stubEnv("OUTBOUND_REPLY_TO", "contact@bedreamy.com.br");
    const env = getOutboundEnv();
    expect(env.replyTo).toBe("contact@bedreamy.com.br");
    expect(env.replyToAll).toEqual(["contact@bedreamy.com.br"]);
    expect(replyToField(env)).toBe("contact@bedreamy.com.br");
  });

  it("inválido: não lança (páginas continuam de pé), mas assertSendReady recusa o envio", () => {
    vi.stubEnv("OUTBOUND_RESEND_API_KEY", "re_test");
    vi.stubEnv("OUTBOUND_FROM", "Luigi <luigi@bedreamy.com.br>");
    vi.stubEnv("OUTBOUND_REPLY_TO", "contact@bedreamy.com.br, invalido");
    const env = getOutboundEnv();
    expect(env.replyTo).toBeNull();
    expect(env.replyToAll).toEqual([]);
    expect(env.replyToError).toMatch(/inválido/);
    expect(() => assertSendReady(env)).toThrow(/Envio real recusado: OUTBOUND_REPLY_TO tem endereço inválido/);
  });

  it("ausente: assertSendReady lista OUTBOUND_REPLY_TO como faltante", () => {
    vi.stubEnv("OUTBOUND_RESEND_API_KEY", "re_test");
    vi.stubEnv("OUTBOUND_FROM", "Luigi <luigi@bedreamy.com.br>");
    vi.stubEnv("OUTBOUND_REPLY_TO", "");
    expect(() => assertSendReady(getOutboundEnv())).toThrow(/OUTBOUND_REPLY_TO/);
  });
});

describe("replyToField — valor de reply_to para o Resend", () => {
  const base: OutboundEnv = {
    apiKey: null,
    from: null,
    replyTo: null,
    replyToAll: [],
    replyToError: null,
    anthropicKey: null,
    utcOffset: "-03:00",
    window: { startMin: 9 * 60, endMin: 17 * 60 + 30 },
    dailyCapEnv: null,
  };

  it("um endereço → string; dois → array; nenhum → undefined", () => {
    expect(replyToField({ ...base, replyTo: "a@x.com.br", replyToAll: ["a@x.com.br"] })).toBe("a@x.com.br");
    expect(replyToField({ ...base, replyTo: "a@x.com.br", replyToAll: ["a@x.com.br", "b@x.com.br"] })).toEqual([
      "a@x.com.br",
      "b@x.com.br",
    ]);
    expect(replyToField(base)).toBeUndefined();
  });
});

describe("Resend — payload com reply_to em array", () => {
  it("sendBatch repassa o array de reply_to sem alterar", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "em_1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createResendClient("re_test");
    const ids = await client.sendBatch(
      [
        {
          from: "Luigi <luigi@bedreamy.com.br>",
          to: ["maria@acme.com.br"],
          subject: "teste",
          text: "corpo",
          reply_to: ["contact@bedreamy.com.br", "luigi.choffe@bedreamy.com.br"],
        },
      ],
      "idem-1",
    );
    expect(ids).toEqual(["em_1"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const [email] = JSON.parse(String(init.body)) as Array<Record<string, unknown>>;
    expect(email.reply_to).toEqual(["contact@bedreamy.com.br", "luigi.choffe@bedreamy.com.br"]);
  });
});
