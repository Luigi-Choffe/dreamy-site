import type { MetadataRoute } from "next";
import { IS_PRODUCTION_SITE } from "@/config/env";
import { routes } from "@/config/site";
import { solutionSlugs } from "@/content/solutions";
import { getPublishedCases, getPublishedInsights, isInsightsSectionLive } from "@/lib/content/collections";
import { absoluteUrl } from "@/lib/seo/metadata";

/** Sitemap nativo — respeita os gates de publicação (ADR-008). Vazio fora de produção. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!IS_PRODUCTION_SITE) return [];
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl(routes.home), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl(routes.solutions), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...solutionSlugs.map((slug) => ({
      url: absoluteUrl(`${routes.solutions}/${slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: absoluteUrl(routes.about), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl(routes.contact), lastModified: now, changeFrequency: "yearly", priority: 0.8 },
    { url: absoluteUrl(routes.privacy), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl(routes.cookies), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const cases = getPublishedCases();
  if (cases.length > 0) {
    entries.push({ url: absoluteUrl(routes.cases), lastModified: now, changeFrequency: "monthly", priority: 0.7 });
    for (const c of cases) {
      entries.push({
        url: absoluteUrl(`${routes.cases}/${c.frontmatter.slug}`),
        lastModified: new Date(c.frontmatter.updatedAt ?? c.frontmatter.publishedAt),
        changeFrequency: "yearly",
        priority: 0.6,
      });
    }
  }

  if (isInsightsSectionLive()) {
    entries.push({ url: absoluteUrl(routes.insights), lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    for (const i of getPublishedInsights()) {
      entries.push({
        url: absoluteUrl(`${routes.insights}/${i.frontmatter.slug}`),
        lastModified: new Date(i.frontmatter.updatedAt ?? i.frontmatter.date),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
