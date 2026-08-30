import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/headers";

// Produção é opt-in explícito (ADR-017): sem NEXT_PUBLIC_SITE_ENV=production tudo sai noindex, mesmo na Vercel.
const isProductionSite = process.env.NEXT_PUBLIC_SITE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 90],
    deviceSizes: [390, 640, 768, 1024, 1280, 1440, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    const security = buildSecurityHeaders({
      enforceCsp: process.env.CSP_ENFORCE === "true",
      isProduction: isProductionSite,
    });
    return [
      {
        source: "/:path*",
        headers: security,
      },
      // Assets imutáveis da marca
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  async redirects() {
    return [
      // Plataforma de vendas (pivô 2026-08-29): com OUTBOUND_PLATFORM_ONLY=true o
      // deploy é só o console — a raiz leva ao login/console; o site institucional
      // vive em outro deploy (com o sócio). Temporário (307) para não grudar em cache.
      ...(process.env.OUTBOUND_PLATFORM_ONLY === "true"
        ? [{ source: "/", destination: "/interno/outbound", permanent: false }]
        : []),
      // apex → www (redundância; a regra principal fica no host/DNS — PRD §52)
      {
        source: "/:path*",
        has: [{ type: "host", value: "dreamy.app.br" }],
        destination: "https://www.dreamy.app.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
