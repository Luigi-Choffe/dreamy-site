import type { SolutionSlug } from "@/config/site";
import type { Solution } from "@/content/types";
import { agentesDeIa } from "./agentes-de-ia";
import { novaReceitaDigital } from "./nova-receita-digital";
import { sistemasSobMedida } from "./sistemas-sob-medida";

/** Exatamente três ofertas comerciais principais (PRD §11). Ordem fixa. */
export const solutions: readonly Solution[] = [novaReceitaDigital, sistemasSobMedida, agentesDeIa];

export const solutionsBySlug: Record<SolutionSlug, Solution> = {
  "nova-receita-digital": novaReceitaDigital,
  "sistemas-sob-medida": sistemasSobMedida,
  "agentes-de-ia": agentesDeIa,
};

export function getSolution(slug: string): Solution | undefined {
  return (solutionsBySlug as Record<string, Solution>)[slug];
}

export const solutionSlugs = Object.keys(solutionsBySlug) as SolutionSlug[];

/** Copy do índice /solucoes (PRD §20). */
export const solutionsIndexContent = {
  eyebrow: "Soluções",
  title: "Três formas de transformar tecnologia em resultado.",
  intro:
    "A Dreamy trabalha com exatamente três frentes. Todas começam pelo mesmo ponto: um problema ou uma oportunidade concreta da sua empresa.",
  seo: {
    title: "Soluções: Nova Receita Digital, Sistemas Sob Medida e Agentes de IA | Dreamy",
    description:
      "Três formas de transformar tecnologia em resultado: novos produtos digitais, sistemas construídos em torno da operação e agentes de IA que executam trabalho real.",
  },
};
