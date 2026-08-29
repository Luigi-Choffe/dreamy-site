import { describe, expect, it } from "vitest";
import { campaigns } from "@/content/outbound";
import { buildEmail, lintEmail, lintErrors } from "@/lib/outbound/render";
import type { CampaignDefinition, CampaignStep, Contact, SolutionAnchor } from "@/lib/outbound/types";

/**
 * Qualidade da copy de outbound (PRD-EMAIL-OUTBOUND §6–§7): toda campanha registrada
 * precisa seguir a sequência padrão e passar no lint com zero erros já RENDERIZADA —
 * o que vai para a caixa do contato é o texto final, não o template.
 */

const sampleContact: Contact = {
  id: "contato-teste",
  email: "maria@acme-exemplo.com.br",
  nome: "Maria",
  cargo: "CEO",
  empresa: "Acme Distribuidora",
  industria: "distribuição",
  custom: {},
  importBatchId: "lote-teste",
  verification: "ok",
  status: "active",
  createdAt: "2026-08-27T12:00:00.000Z",
};

/** Página da solução âncora no site (PRD outbound §8). */
const SOLUTION_PAGE: Record<SolutionAnchor, string> = {
  "nova-receita": "nova-receita-digital",
  sistema: "sistemas-sob-medida",
  "agente-ia": "agentes-de-ia",
};

const URL_RE = /https?:\/\//i;

function render(campaign: CampaignDefinition, step: CampaignStep) {
  // Variáveis de enriquecimento ({{abertura}} etc.) usam a amostra da própria
  // definição (sampleCustom) — no envio real precisam existir no contato.
  const contact: Contact = {
    ...sampleContact,
    industria: campaign.industria,
    custom: { ...campaign.sampleCustom },
  };
  return buildEmail(contact, campaign, step, { replyTo: "contato@dreamy.app.br" });
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

describe("registry de campanhas (src/content/outbound)", () => {
  it("tem campanhas registradas com slugs únicos e em kebab-case", () => {
    expect(campaigns.length).toBeGreaterThanOrEqual(3);
    const slugs = campaigns.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("campanhas-modelo (exemplo-*) permanecem draft com industria 'exemplo'", () => {
    const modelos = campaigns.filter((c) => c.slug.startsWith("exemplo-"));
    expect(modelos.length).toBeGreaterThanOrEqual(3);
    for (const c of modelos) {
      expect(c.status).toBe("draft");
      expect(c.industria).toBe("exemplo");
    }
  });
});

for (const campaign of campaigns) {
  describe(`campanha ${campaign.slug}`, () => {
    it("segue a sequência do PRD §7: 4 passos e1–e4, offsets crescentes, cadência de 14–21 dias", () => {
      expect(campaign.steps).toHaveLength(4);
      expect(campaign.steps.map((s) => s.id)).toEqual(["e1", "e2", "e3", "e4"]);
      expect(campaign.steps[0]!.offsetDays).toBe(0);
      for (const step of campaign.steps.slice(1)) {
        expect(step.offsetDays, `${step.id} precisa vir dias depois do passo anterior`).toBeGreaterThan(0);
      }
      const totalDias = campaign.steps.reduce((acc, s) => acc + s.offsetDays, 0);
      expect(totalDias).toBeGreaterThanOrEqual(14);
      expect(totalDias).toBeLessThanOrEqual(21);
    });

    it("só o e3 tem withLink (primeiros toques sem link — PRD §7)", () => {
      expect(campaign.steps.filter((s) => s.withLink).map((s) => s.id)).toEqual(["e3"]);
    });

    for (const step of campaign.steps) {
      describe(`passo ${step.id}`, () => {
        it("renderiza com as vars de amostra e passa no lint com ZERO erros", () => {
          const email = render(campaign, step); // lança se faltar variável
          const issues = lintEmail(email.subject, email.text);
          expect(lintErrors(issues)).toEqual([]);
        });

        it("corpo entre 30 e 140 palavras; assunto com no máximo 60 caracteres", () => {
          const email = render(campaign, step);
          const palavras = countWords(email.text);
          expect(palavras).toBeGreaterThanOrEqual(30);
          expect(palavras).toBeLessThanOrEqual(140);
          expect(email.subject.length).toBeLessThanOrEqual(60);
        });

        it(step.withLink ? "carrega o link da solução âncora com UTM padrão" : "não contém URL", () => {
          const email = render(campaign, step);
          if (step.withLink) {
            const url =
              `https://www.dreamy.app.br/solucoes/${SOLUTION_PAGE[campaign.anchor]}` +
              `?solucao=${campaign.anchor}&utm_source=outbound&utm_medium=email` +
              `&utm_campaign=${campaign.slug}&utm_content=e3`;
            expect(email.text).toContain(url);
          } else {
            expect(URL_RE.test(email.subject)).toBe(false);
            expect(URL_RE.test(email.text)).toBe(false);
          }
        });
      });
    }
  });
}
