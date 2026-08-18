import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { IS_PRODUCTION_SITE } from "@/config/env";
import {
  caseFrontmatterSchema,
  insightFrontmatterSchema,
  type CaseFrontmatter,
  type InsightFrontmatter,
} from "./schemas";

/**
 * Loaders de conteúdo MDX (V1 — arquivos versionados no Git, ADR-007).
 * Somente servidor (usa fs). Migração futura para CMS: reimplementar estas funções.
 */

const CONTENT_ROOT = path.join(process.cwd(), "src", "content");
export const MIN_INSIGHTS_TO_PUBLISH = 3;

/**
 * Preview de conteúdo (revisão interna): CONTENT_PREVIEW=true mostra cases não aprovados e
 * insights em `review`, com gates relaxados. NUNCA ativo em produção (IS_PRODUCTION_SITE),
 * e ambientes de preview já são noindex (PRD §53).
 */
export const CONTENT_PREVIEW = process.env.CONTENT_PREVIEW === "true" && !IS_PRODUCTION_SITE;

export interface ContentEntry<T> {
  frontmatter: T;
  body: string;
  filePath: string;
}

function readCollection<T>(dir: string, schema: z.ZodType<T>): ContentEntry<T>[] {
  const abs = path.join(CONTENT_ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const files = fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .sort();
  const entries: ContentEntry<T>[] = [];
  for (const file of files) {
    const filePath = path.join(abs, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(raw);
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`[content] Frontmatter inválido em ${dir}/${file}: ${issues}`);
    }
    const fm = parsed.data as T & { slug: string };
    const expectedSlug = file.replace(/\.mdx$/, "");
    if (fm.slug !== expectedSlug) {
      throw new Error(`[content] slug "${fm.slug}" difere do nome do arquivo em ${dir}/${file}`);
    }
    entries.push({ frontmatter: parsed.data, body: content, filePath });
  }
  return entries;
}

/* ------------------------------ Cases ------------------------------------ */

let casesCache: ContentEntry<CaseFrontmatter>[] | null = null;

function loadCases() {
  if (!casesCache || !IS_PRODUCTION_SITE) casesCache = readCollection("cases", caseFrontmatterSchema);
  return casesCache;
}

/** Cases aprovados (gate: `approved: true`) ordenados por data. */
export function getPublishedCases(): ContentEntry<CaseFrontmatter>[] {
  return loadCases()
    .filter((c) => c.frontmatter.approved || CONTENT_PREVIEW)
    .sort((a, b) => b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt));
}

export function getCaseBySlug(slug: string): ContentEntry<CaseFrontmatter> | undefined {
  return getPublishedCases().find((c) => c.frontmatter.slug === slug);
}

export function hasPublishedCases(): boolean {
  return getPublishedCases().length > 0;
}

/* ----------------------------- Insights ---------------------------------- */

let insightsCache: ContentEntry<InsightFrontmatter>[] | null = null;

function loadInsights() {
  if (!insightsCache || !IS_PRODUCTION_SITE) insightsCache = readCollection("insights", insightFrontmatterSchema);
  return insightsCache;
}

/** Insights com `status: published`, ordenados por data (mais recente primeiro). */
export function getPublishedInsights(): ContentEntry<InsightFrontmatter>[] {
  return loadInsights()
    .filter((i) => i.frontmatter.status === "published" || (CONTENT_PREVIEW && i.frontmatter.status === "review"))
    .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date));
}

/** A seção Insights só existe com ≥ 3 conteúdos publicados (PRD §13, §33). */
export function isInsightsSectionLive(): boolean {
  return getPublishedInsights().length >= (CONTENT_PREVIEW ? 1 : MIN_INSIGHTS_TO_PUBLISH);
}

export function getInsightBySlug(slug: string): ContentEntry<InsightFrontmatter> | undefined {
  if (!isInsightsSectionLive()) return undefined;
  return getPublishedInsights().find((i) => i.frontmatter.slug === slug);
}

/** Flags de navegação (PRD §13). */
export function getContentFlags() {
  return {
    hasCases: hasPublishedCases(),
    hasInsights: isInsightsSectionLive(),
  };
}
