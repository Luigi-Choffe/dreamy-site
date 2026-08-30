import type { MetadataRoute } from "next";
import { IS_PRODUCTION_SITE, SITE_URL } from "@/config/env";

/** Fora de produção: bloqueia tudo (PRD §53). */
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_SITE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    // /interno = plataforma de vendas (console do MORK) — nunca indexável, mesmo em produção.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/interno/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
