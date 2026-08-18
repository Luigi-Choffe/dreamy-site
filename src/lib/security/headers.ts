/**
 * Headers de segurança (PRD §76). CSP em Report-Only por padrão; enforce com CSP_ENFORCE=true
 * após validar no browser que GTM/GA4/Meta/LinkedIn/Turnstile funcionam.
 * Sem nonce (páginas 100% estáticas — ADR-010): `'unsafe-inline'` é necessário para GTM.
 */

export interface SecurityHeaderOptions {
  enforceCsp: boolean;
  isProduction: boolean;
  /** Origem extra permitida (ex.: ferramenta de agendamento embutida) */
  extraFrameSrc?: string[];
  extraConnectSrc?: string[];
}

export function buildCsp(opts: Partial<SecurityHeaderOptions> = {}): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://connect.facebook.net",
    "https://snap.licdn.com",
    "https://*.licdn.com",
    "https://challenges.cloudflare.com",
    "https://vercel.live",
  ];
  const connectSrc = [
    "'self'",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://stats.g.doubleclick.net",
    "https://www.facebook.com",
    "https://*.facebook.com",
    "https://px.ads.linkedin.com",
    "https://*.linkedin.com",
    "https://*.licdn.com",
    "https://challenges.cloudflare.com",
    "https://vitals.vercel-insights.com",
    ...(opts.extraConnectSrc ?? []),
  ];
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.google.com",
    "https://*.google.com.br",
    "https://www.facebook.com",
    "https://*.facebook.com",
    "https://px.ads.linkedin.com",
    "https://*.linkedin.com",
  ];
  const frameSrc = [
    "'self'",
    "https://www.googletagmanager.com",
    "https://challenges.cloudflare.com",
    "https://www.facebook.com",
    "https://vercel.live",
    ...(opts.extraFrameSrc ?? []),
  ];
  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSrc.join(" ")}`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    `frame-ancestors 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ];
  // ignorada (com aviso no console) em Report-Only; só entra no modo enforce
  if (opts.enforceCsp) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function buildSecurityHeaders(opts: SecurityHeaderOptions): Array<{ key: string; value: string }> {
  const headers: Array<{ key: string; value: string }> = [
    { key: opts.enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: buildCsp(opts) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
    },
  ];
  if (opts.isProduction) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  } else {
    // Preview/staging nunca indexado (PRD §53) — redundância ao <meta robots> e ao robots.txt
    headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
  }
  return headers;
}
