import { describe, expect, it } from "vitest";
import {
  MAX_SCORE,
  bucketFor,
  isCorporateEmail,
  isExecutiveRole,
  scoreLead,
  scoringConfig,
  urgencyBucket,
} from "@/lib/leads/scoring";

const base = {
  role: "Analista",
  email: "pessoa@gmail.com",
  urgency: "pesquisando" as const,
  description: "curta",
  investment: "" as const,
  need: "outro" as const,
};

describe("lead scoring (PRD §38)", () => {
  it("máximo é 100 e cada regra soma o valor configurado", () => {
    expect(MAX_SCORE).toBe(100);
    const full = scoreLead({
      role: "CEO",
      email: "ceo@empresa.com.br",
      urgency: "agora",
      description: "x".repeat(scoringConfig.detailedPain.minLength),
      investment: "50-100k",
      need: "sistema",
    });
    expect(full.score).toBe(100);
    expect(full.bucket).toBe("alta");
  });

  it("lead sem sinais fica em avaliação", () => {
    const r = scoreLead(base);
    expect(r.score).toBe(0);
    expect(r.bucket).toBe("avaliacao");
  });

  it("buckets: 75–100 alta, 50–74 média, 0–49 avaliação", () => {
    expect(bucketFor(100)).toBe("alta");
    expect(bucketFor(75)).toBe("alta");
    expect(bucketFor(74)).toBe("media");
    expect(bucketFor(50)).toBe("media");
    expect(bucketFor(49)).toBe("avaliacao");
    expect(bucketFor(0)).toBe("avaliacao");
  });

  it("detecta cargo executivo por palavra inteira (sem falso positivo em 'supervisor')", () => {
    expect(isExecutiveRole("CEO")).toBe(true);
    expect(isExecutiveRole("Sócio-diretor")).toBe(true);
    expect(isExecutiveRole("Diretora de Operações")).toBe(true);
    expect(isExecutiveRole("Head de Vendas")).toBe(true);
    expect(isExecutiveRole("VP Comercial")).toBe(true);
    expect(isExecutiveRole("Supervisor de loja")).toBe(false);
    expect(isExecutiveRole("Analista de sistemas")).toBe(false);
  });

  it("e-mail corporativo vs gratuito", () => {
    expect(isCorporateEmail("ana@minhaempresa.com.br")).toBe(true);
    expect(isCorporateEmail("ana@gmail.com")).toBe(false);
    expect(isCorporateEmail("ana@outlook.com.br")).toBe(false);
  });

  it("urgência ≤ 90 dias pontua; buckets de urgência mapeiam corretamente", () => {
    expect(scoreLead({ ...base, urgency: "1-3-meses" }).breakdown.urgency).toBe(20);
    expect(scoreLead({ ...base, urgency: "3-6-meses" }).breakdown.urgency).toBe(0);
    expect(urgencyBucket("agora")).toBe("ate_30d");
    expect(urgencyBucket("30-dias")).toBe("ate_30d");
    expect(urgencyBucket("1-3-meses")).toBe("1_3m");
    expect(urgencyBucket("3-6-meses")).toBe("3_6m");
    expect(urgencyBucket("pesquisando")).toBe("pesquisando");
  });

  it("investimento ≥ 20 mil pontua; 'até 20 mil' e 'indefinido' não", () => {
    expect(scoreLead({ ...base, investment: "20-50k" }).breakdown.investment).toBe(15);
    expect(scoreLead({ ...base, investment: "ate-20k" }).breakdown.investment).toBe(0);
    expect(scoreLead({ ...base, investment: "indefinido" }).breakdown.investment).toBe(0);
  });

  it("solução identificada pontua; 'não sei' e 'outro' não", () => {
    expect(scoreLead({ ...base, need: "agente-ia" }).breakdown.identifiedSolution).toBe(10);
    expect(scoreLead({ ...base, need: "nao-sei" }).breakdown.identifiedSolution).toBe(0);
  });
});
