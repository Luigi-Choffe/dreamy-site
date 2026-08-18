/**
 * Atribuição (PRD §45): captura UTMs, referrer e landing page na primeira página
 * e preserva durante o fluxo até o formulário. Sem fingerprinting.
 * - sessionStorage: sempre (dura a sessão — necessário para atribuição do lead)
 * - cookie `dreamy_attr` (30 dias, first-touch): somente com consentimento de analytics
 */
import { hasAnalyticsConsent } from "@/lib/consent/consent";

export const ATTRIBUTION_KEY = "dreamy_attr";
const COOKIE_MAX_AGE_DAYS = 30;

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
  /** epoch ms */
  first_seen?: number;
}

function sanitize(value: string | null | undefined, max = 200): string | undefined {
  if (!value) return undefined;
  const v = value
    .replace(/[\u0000-\u001F\u007F-\u009F<>]/g, "")
    .trim()
    .slice(0, max);
  return v || undefined;
}

/** Extrai UTMs de uma URL/search string (puro — testável). */
export function parseUtms(search: string): Partial<Record<UtmKey, string>> {
  const params = new URLSearchParams(search);
  const out: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const v = sanitize(params.get(key));
    if (v) out[key] = v;
  }
  return out;
}

function readCookie(): Attribution | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${ATTRIBUTION_KEY}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.slice(ATTRIBUTION_KEY.length + 1))) as Attribution;
  } catch {
    return null;
  }
}

function writeCookie(attr: Attribution) {
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ATTRIBUTION_KEY}=${encodeURIComponent(JSON.stringify(attr))}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function readSession(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

function writeSession(attr: Attribution) {
  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attr));
  } catch {
    /* storage indisponível — segue sem persistência */
  }
}

/**
 * Chamado em cada page view. Regra first-touch: se já existe atribuição na sessão
 * (ou no cookie consentido), mantém; UTMs novas na URL sobrescrevem (nova campanha).
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const existing = readSession() ?? readCookie();
  const utms = parseUtms(window.location.search);
  const hasNewUtms = Object.keys(utms).length > 0;

  let attr: Attribution;
  if (existing && !hasNewUtms) {
    attr = existing;
  } else {
    attr = {
      ...(existing ?? {}),
      ...utms,
      referrer: existing?.referrer ?? sanitize(document.referrer, 300),
      landing_page: existing?.landing_page ?? sanitize(window.location.pathname + window.location.search, 300),
      first_seen: existing?.first_seen ?? Date.now(),
    };
    if (hasNewUtms) {
      attr.landing_page = sanitize(window.location.pathname + window.location.search, 300);
      attr.referrer = sanitize(document.referrer, 300);
    }
  }

  writeSession(attr);
  if (hasAnalyticsConsent()) writeCookie(attr);
  return attr;
}

/** Atribuição atual para anexar ao lead. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  return readSession() ?? readCookie() ?? {};
}
