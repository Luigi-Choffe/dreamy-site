import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiAvailable,
  buildBriefingPrompt,
  buildTriagePrompt,
  generateBriefing,
  parseTriageResponse,
  redactEmails,
  sanitizeAiText,
  type BriefingAggregates,
} from "../../src/lib/outbound/ai";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const AGG: BriefingAggregates = {
  dateKey: "2026-08-31",
  armada: true,
  capDia: 15,
  usadosHoje: 0,
  enviadosTotal: 30,
  entreguesTotal: 28,
  bounceRatePct: 0,
  respostasReais: 3,
  interessados: 2,
  tarefasHojeOuVencidas: 1,
  demandasPendentes: 2,
  reunioesMarcadas: 1,
  reunioesRealizadas: 0,
  pipeline: [{ estagio: "respondeu", quantidade: 3 }],
  campanhas: [{ industria: "construção incorporadora", enviados: 30, respostas: 3, interessados: 2 }],
};

describe("disponibilidade e higiene", () => {
  it("aiAvailable acompanha a env", () => {
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "");
    vi.stubEnv("OUTBOUND_OPENAI_API_KEY", "");
    expect(aiAvailable()).toBe(false);
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "sk-teste");
    expect(aiAvailable()).toBe(true);
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "");
    vi.stubEnv("OUTBOUND_OPENAI_API_KEY", "sk-openai");
    expect(aiAvailable()).toBe(true);
  });

  it("redactEmails remove qualquer coisa com arroba", () => {
    expect(redactEmails("fale com joao.silva@empresa.com.br hoje")).not.toContain("@");
  });

  it("sanitizeAiText elimina travessão", () => {
    const out = sanitizeAiText("faz sentido — me diga um horário – pode ser quinta");
    expect(out).not.toMatch(/[—–]/);
    expect(out).toContain("me diga um horário");
  });
});

describe("prompts sem PII", () => {
  it("prompt de triagem NUNCA contém arroba, mesmo com e-mail no texto colado", () => {
    const prompt = buildTriagePrompt({
      texto: "pode falar com meu sócio: fernando@construtora.com.br, ele cuida disso",
      primeiroNome: "Maria",
      cargo: "Diretora",
      industria: "construção",
    });
    expect(prompt).not.toContain("@");
    expect(prompt).toContain("Maria");
  });

  it("prompt do briefing só leva agregados (sem arroba) e proíbe inventar números", () => {
    const prompt = buildBriefingPrompt(AGG);
    expect(prompt).not.toContain("@");
    expect(prompt).toContain("2026-08-31");
    expect(prompt.toLowerCase()).toContain("sem inventar");
  });
});

describe("parseTriageResponse", () => {
  it("extrai o JSON mesmo cercado de prosa", () => {
    const out = parseTriageResponse(
      'Claro! Aqui está:\n{"classe":"interested","resumo":"Quer conversar na sexta.","rascunho":"Fechado, sexta 10h funciona bem por aqui."}\nEspero ter ajudado.',
    );
    expect(out.classe).toBe("interested");
    expect(out.rascunho).toContain("sexta 10h");
  });

  it("classe desconhecida ou JSON quebrado degradam para other", () => {
    expect(parseTriageResponse('{"classe":"foo","resumo":"x","rascunho":"y"}').classe).toBe("other");
    const broken = parseTriageResponse("não consegui");
    expect(broken.classe).toBe("other");
    expect(broken.resumo).toContain("não consegui");
  });

  it("saída vem sem travessão", () => {
    const out = parseTriageResponse(
      '{"classe":"not_now","resumo":"volta em outubro — sem agenda","rascunho":"ok — combinado"}',
    );
    expect(out.resumo).not.toMatch(/[—–]/);
    expect(out.rascunho).not.toMatch(/[—–]/);
  });
});

describe("generateBriefing (fetch mockado)", () => {
  it("devolve o texto sanitizado no sucesso", async () => {
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "sk-teste");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ content: [{ type: "text", text: "Dia forte — 2 interessados." }] }), {
            status: 200,
          }),
      ),
    );
    const out = await generateBriefing(AGG);
    expect(out).toContain("2 interessados");
    expect(out).not.toMatch(/[—–]/);
  });

  it("429 vira mensagem acionável em pt-BR", async () => {
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "sk-teste");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );
    await expect(generateBriefing(AGG)).rejects.toThrow(/limite de uso/i);
  });

  it("sem chave, falha fechado com instrução", async () => {
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "");
    vi.stubEnv("OUTBOUND_OPENAI_API_KEY", "");
    await expect(generateBriefing(AGG)).rejects.toThrow(/OUTBOUND_ANTHROPIC_API_KEY ou OUTBOUND_OPENAI_API_KEY/);
  });
});

describe("motor OpenAI (fetch mockado)", () => {
  it("com só a chave da OpenAI, o briefing sai pelo chat/completions sem PII", async () => {
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "");
    vi.stubEnv("OUTBOUND_OPENAI_API_KEY", "sk-openai");
    vi.stubEnv("OUTBOUND_OPENAI_MODEL", "gpt-teste");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "Dia forte — 2 interessados." } }] }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await generateBriefing(AGG);
    expect(out).toContain("2 interessados");
    expect(out).not.toMatch(/[—–]/);
    const call = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(String(call[0])).toContain("api.openai.com");
    const body = JSON.parse(call[1].body) as { model: string };
    expect(body.model).toBe("gpt-teste");
    expect(JSON.stringify(body)).not.toContain("@");
  });

  it("429 da OpenAI vira aviso de crédito/limite", async () => {
    vi.stubEnv("OUTBOUND_ANTHROPIC_API_KEY", "");
    vi.stubEnv("OUTBOUND_OPENAI_API_KEY", "sk-openai");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );
    await expect(generateBriefing(AGG)).rejects.toThrow(/crédito|limite/i);
  });
});
