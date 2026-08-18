/**
 * Configuração institucional do site — ÚNICO lugar para dados da empresa,
 * canais de contato e links externos (PRD §109: itens configuráveis).
 *
 * REGRA: não inventar valores. Campos `null` são omitidos pela UI.
 * Origem de cada valor documentada em docs/CONTENT-SOURCES.md.
 */
import { SITE_URL } from "@/config/env";

export const siteConfig = {
  name: "Dreamy",
  legalName: null as string | null, // TODO_CONFIRM: razão social (docs/CONTENT-SOURCES.md)
  cnpj: null as string | null, // TODO_CONFIRM: CNPJ
  url: SITE_URL,
  locale: "pt-BR",
  language: "pt-BR",
  region: "BR",
  tagline: "Software sob medida e Agentes de IA para empresas",
  description:
    "Criamos produtos digitais, sistemas personalizados e agentes de IA para empresas que querem aumentar receita e melhorar operações.",
  foundingLocation: null as string | null, // TODO_CONFIRM: cidade/estado

  contact: {
    /**
     * WhatsApp comercial — já público no site atual (wa.me/5511948793233) e no deck
     * institucional. Confirmar antes do lançamento (ADR-013).
     */
    whatsappNumber: "5511948793233" as string | null,
    whatsappMessage: "Olá! Gostaria de conversar sobre um problema ou oportunidade da minha empresa.",
    email: null as string | null, // TODO_CONFIRM: e-mail público de contato
    phone: null as string | null,
    address: null as string | null,
  },

  social: {
    linkedin: null as string | null, // TODO_CONFIRM: URL da página da Dreamy no LinkedIn
    instagram: null as string | null,
    youtube: null as string | null,
  },

  /** Ano de fundação / início de copyright — omitido se null. */
  copyrightStartYear: null as number | null,
} as const;

export type SiteConfig = typeof siteConfig;

export function whatsappUrl(message?: string): string | null {
  const number = siteConfig.contact.whatsappNumber;
  if (!number) return null;
  const text = encodeURIComponent(message ?? siteConfig.contact.whatsappMessage);
  return `https://wa.me/${number}?text=${text}`;
}

/** Rotas canônicas do site (fonte única para nav, sitemap, CTAs e testes). */
export const routes = {
  home: "/",
  solutions: "/solucoes",
  solutionNewRevenue: "/solucoes/nova-receita-digital",
  solutionCustomSystems: "/solucoes/sistemas-sob-medida",
  solutionAiAgents: "/solucoes/agentes-de-ia",
  cases: "/cases",
  about: "/sobre",
  insights: "/insights",
  contact: "/contato",
  privacy: "/privacidade",
  cookies: "/cookies",
  howWeWork: "/#como-trabalhamos",
} as const;

export type SolutionSlug = "nova-receita-digital" | "sistemas-sob-medida" | "agentes-de-ia";

/** Parâmetro `?solucao=` aceito em /contato (PRD §27–§29) → necessidade pré-selecionada. */
export const contactSolutionParams = {
  "nova-receita": "nova-receita",
  sistema: "sistema",
  "agente-ia": "agente-ia",
} as const;
export type ContactSolutionParam = keyof typeof contactSolutionParams;

export function contactUrl(solution?: ContactSolutionParam): string {
  return solution ? `${routes.contact}?solucao=${solution}` : routes.contact;
}
