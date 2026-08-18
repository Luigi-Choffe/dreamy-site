/**
 * Modelos de conteúdo (PRD §82). Sem campo de testimonial — por regra.
 */
import type { ContactSolutionParam, SolutionSlug } from "@/config/site";

export interface SeoFields {
  title: string;
  description: string;
}

export interface CtaContent {
  label: string;
  href: string;
}

export interface FlowStep {
  /** Rótulo curto exibido no nó */
  label: string;
  /** Texto complementar opcional (tooltip / legenda) */
  detail?: string;
}

export interface FlowContent {
  /** Título acessível do diagrama (também usado como <title> do SVG) */
  title: string;
  steps: FlowStep[];
}

export interface ListSection {
  title: string;
  intro?: string;
  items: string[];
  note?: string;
}

export interface UseCase {
  id: string;
  title: string;
  description?: string;
  tasks: string[];
  flow: FlowContent;
}

export interface Solution {
  slug: SolutionSlug;
  /** Nome curto (nav, cards, breadcrumbs) */
  name: string;
  /** Número exibido na Home (01, 02, 03) */
  order: "01" | "02" | "03";
  eyebrow: string;
  /** Promessa/H1 da página */
  headline: string;
  /** Intro da página */
  intro: string;
  /** Descrição curta (card da Home / índice de soluções) */
  description: string;
  /** Tagline curta do card da Home */
  cardTitle: string;
  cardCta: string;
  problem: ListSection;
  solution?: ListSection;
  message?: { title: string; paragraphs: string[] };
  examples?: ListSection;
  useCases?: UseCase[];
  principles?: ListSection;
  integrations?: ListSection & { nodes: string[] };
  highlight?: string;
  process: FlowContent;
  /** Visual do produto (PRD §61) */
  visual: FlowContent;
  cta: CtaContent;
  contactParam: ContactSolutionParam;
  seo: SeoFields;
  /** Termos de SEO do cluster (usados apenas em copy/estrutura, nunca keyword stuffing) */
  keywords: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProcessStep {
  number: string;
  title: string;
  description: string;
}
