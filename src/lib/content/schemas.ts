import { z } from "zod";

z.config({ jitless: true });

/**
 * Schemas de frontmatter (PRD §82–§83). Sem campo de testimonial — por regra.
 * `approved`/`status` são os gates de publicação (ADR-008).
 */

/** Datas YAML podem chegar como Date (gray-matter) ou string "YYYY-MM-DD". */
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato YYYY-MM-DD"),
);
const optionalIsoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
);

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug deve usar apenas letras minúsculas, números e hífens");

const seoSchema = z
  .object({
    title: z.string().min(10).max(70),
    description: z.string().min(50).max(170),
  })
  .partial();

const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().optional(),
});

export const caseMetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  /** contexto "antes/depois" opcional (resultado operacional é válido) */
  before: z.string().optional(),
  after: z.string().optional(),
  /** referência obrigatória em docs/CONTENT-SOURCES.md */
  sourceRef: z.string().min(1),
});

export const caseFrontmatterSchema = z.object({
  slug: slugSchema,
  client: z.string().min(1),
  sector: z.string().min(1),
  summary: z.string().min(20).max(300),
  problem: z.string().min(20),
  solution: z.string().min(20),
  result: z.string().min(10),
  /** solução relacionada (para navegação cruzada) */
  solutionSlug: z.enum(["nova-receita-digital", "sistemas-sob-medida", "agentes-de-ia"]).optional(),
  images: z.array(imageSchema).default([]),
  cover: imageSchema.optional(),
  metrics: z.array(caseMetricSchema).default([]),
  approved: z.boolean(),
  /** aprovação: quem/quando/como (auditoria interna, não exibido) */
  approvalRef: z.string().optional(),
  publishedAt: isoDate,
  updatedAt: optionalIsoDate,
  featured: z.boolean().default(false),
  seo: seoSchema.default({}),
});

export type CaseFrontmatter = z.infer<typeof caseFrontmatterSchema>;

export const insightFrontmatterSchema = z.object({
  slug: slugSchema,
  title: z.string().min(10).max(120),
  description: z.string().min(50).max(300),
  date: isoDate,
  updatedAt: optionalIsoDate,
  author: z.string().min(1),
  image: imageSchema.optional(),
  status: z.enum(["draft", "review", "published"]),
  tags: z.array(z.string()).default([]),
  /** cluster de SEO relacionado */
  cluster: z.enum(["software-personalizado", "ia", "sistemas", "receita"]).optional(),
  seo: seoSchema.default({}),
});

export type InsightFrontmatter = z.infer<typeof insightFrontmatterSchema>;
