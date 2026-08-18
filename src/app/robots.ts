import type { MetadataRoute } from "next";
import { IS_PRODUCTION_SITE, SITE_URL } from "@/config/env";

/** Fora de produção: bloqueia tudo (PRD §53). */
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_SITE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dev/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
