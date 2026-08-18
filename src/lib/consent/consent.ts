/**
 * Gerenciamento de consentimento (PRD §73) + Google Consent Mode v2.
 * Categorias: necessário (sempre), analytics, marketing.
 * Persistência: cookie first-party `dreamy_consent` (180 dias).
 */

export const CONSENT_COOKIE = "dreamy_consent";
export const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_DAYS = 180;
export const CONSENT_CHANGE_EVENT = "dreamy:consent-change";
export const CONSENT_OPEN_EVENT = "dreamy:consent-open";

export interface ConsentState {
  v: number;
  analytics: boolean;
  marketing: boolean;
  /** epoch ms da decisão */
  t: number;
}

export function readConsentCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1));
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.v !== CONSENT_VERSION) return null;
    return {
      v: CONSENT_VERSION,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      t: Number(parsed.t) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeConsentCookie(state: Omit<ConsentState, "v" | "t">): ConsentState {
  const value: ConsentState = {
    v: CONSENT_VERSION,
    analytics: state.analytics,
    marketing: state.marketing,
    t: Date.now(),
  };
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  return value;
}

/** Aplica o estado ao Google Consent Mode v2 (via gtag definido no head) e notifica o app. */
export function applyConsent(state: ConsentState): void {
  if (typeof window === "undefined") return;
  const granted = (b: boolean) => (b ? "granted" : "denied");
  window.gtag?.("consent", "update", {
    analytics_storage: granted(state.analytics),
    ad_storage: granted(state.marketing),
    ad_user_data: granted(state.marketing),
    ad_personalization: granted(state.marketing),
    functionality_storage: "granted",
    security_storage: "granted",
  });
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: "consent_update",
    consent_analytics: state.analytics,
    consent_marketing: state.marketing,
  });
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state }));
}

/** Salva + aplica. */
export function saveConsent(state: Omit<ConsentState, "v" | "t">): ConsentState {
  const saved = writeConsentCookie(state);
  applyConsent(saved);
  return saved;
}

/** Abre o painel de preferências a partir de qualquer lugar (footer, /cookies). */
export function openConsentPreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

export function hasAnalyticsConsent(): boolean {
  return readConsentCookie()?.analytics === true;
}

/**
 * Script inline executado no <head> ANTES do GTM: cria dataLayer/gtag e define
 * o consent default (denied) ou restaura a escolha salva. Sem dependências.
 */
export const CONSENT_HEAD_SCRIPT = `
(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var state = null;
  try {
    var m = document.cookie.split('; ').find(function(c){ return c.indexOf('${CONSENT_COOKIE}=') === 0; });
    if (m) { var p = JSON.parse(decodeURIComponent(m.slice(${CONSENT_COOKIE.length + 1}))); if (p && p.v === ${CONSENT_VERSION}) state = p; }
  } catch (e) {}
  var a = state && state.analytics ? 'granted' : 'denied';
  var mk = state && state.marketing ? 'granted' : 'denied';
  gtag('consent', 'default', {
    analytics_storage: a,
    ad_storage: mk,
    ad_user_data: mk,
    ad_personalization: mk,
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);
})();
`.trim();
