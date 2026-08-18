/**
 * Acesso centralizado às variáveis de ambiente públicas e flags de ambiente.
 * Nunca exponha secrets aqui (apenas NEXT_PUBLIC_*).
 */
const DEFAULT_SITE_URL = "https://www.dreamy.app.br";

function normalizeUrl(url: string | undefined): string {
  if (!url) return DEFAULT_SITE_URL;
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** URL canônica do site (sem barra final). */
export const SITE_URL = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);

/**
 * `true` somente em produção real, e apenas por opt-in explícito (`NEXT_PUBLIC_SITE_ENV=production`).
 * Preview/staging/dev (inclusive o ambiente "production" da Vercel em `*.vercel.app`) => noindex + robots disallow (PRD §53).
 * Não inferimos de VERCEL_ENV de propósito: o domínio oficial só entra no ar quando a variável for definida (ADR-017).
 */
export const IS_PRODUCTION_SITE = process.env.NEXT_PUBLIC_SITE_ENV === "production";

export const IS_DEV = process.env.NODE_ENV === "development";

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || null;
export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || null;
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
