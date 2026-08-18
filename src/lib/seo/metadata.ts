import type { Metadata } from "next";
import { IS_PRODUCTION_SITE, SITE_URL } from "@/config/env";
import { siteConfig } from "@/config/site";

interface PageMetadataInput {
  title: string;
  description: string;
  /** Caminho canônico, ex.: "/solucoes/agentes-de-ia" */
  path: string;
  /** Sobrescreve o título usado no OG (por padrão = title). */
  ogTitle?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  /** Força noindex (ex.: página interna de dev). */
  noIndex?: boolean;
  /** Imagem OG explícita (por padrão, opengraph-image.tsx da rota gera). */
  image?: { url: string; width: number; height: number; alt: string };
}

/** Constrói a URL absoluta canônica. */
export function absoluteUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `${SITE_URL}/` : `${SITE_URL}${clean}`;
}

/** Robots: fora de produção tudo é noindex (PRD §53). */
export function robotsFor(noIndex?: boolean): Metadata["robots"] {
  if (noIndex || !IS_PRODUCTION_SITE) {
    return { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } };
  }
  return {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  };
}

/** Metadata padrão de página (title, description, canonical, OG, Twitter, robots). */
export function createPageMetadata(input: PageMetadataInput): Metadata {
  const url = absoluteUrl(input.path);
  const ogTitle = input.ogTitle ?? input.title;
  return {
    title: { absolute: input.title },
    description: input.description,
    alternates: { canonical: url },
    robots: robotsFor(input.noIndex),
    openGraph: {
      type: input.type ?? "website",
      url,
      siteName: siteConfig.name,
      locale: "pt_BR",
      title: ogTitle,
      description: input.description,
      ...(input.image ? { images: [input.image] } : {}),
      ...(input.type === "article"
        ? { publishedTime: input.publishedTime, modifiedTime: input.modifiedTime, authors: input.authors }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: input.description,
      ...(input.image ? { images: [input.image.url] } : {}),
    },
  };
}
