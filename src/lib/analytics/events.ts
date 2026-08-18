/**
 * Contrato tipado do dataLayer (docs/TRACKING.md — PRD §44).
 * Regras: nomes de eventos e parâmetros fechados; PII proibida em qualquer parâmetro.
 * Este módulo é seguro no servidor (no-op) e no cliente (window.dataLayer.push).
 */

export type SolutionParam = "nova-receita-digital" | "sistemas-sob-medida" | "agentes-de-ia";
export type LeadBucket = "alta" | "media" | "avaliacao";
export type UrgencyBucket = "ate_30d" | "1_3m" | "3_6m" | "pesquisando";
export type CtaIntent =
  | "contact"
  | "solutions"
  | `solution:${SolutionParam}`
  | "case"
  | "whatsapp"
  | "booking"
  | "about"
  | "how_we_work"
  | "home";
export type FormErrorType = "validation" | "server" | "network" | "rate_limit";

export type AnalyticsEvent =
  | { event: "page_view"; page: string; page_title?: string }
  | { event: "cta_click"; cta_id: string; cta_location: string; page: string; intent: CtaIntent }
  | { event: "solution_view"; solution: SolutionParam }
  | { event: "case_view"; case_slug: string }
  | { event: "form_start"; page: string }
  | { event: "form_step_complete"; step: 1 | 2 }
  | { event: "form_error"; field: string; error_type: FormErrorType }
  | {
      event: "generate_lead";
      solution: string;
      lead_bucket: LeadBucket;
      urgency_bucket: UrgencyBucket;
    }
  | { event: "schedule_start"; page: string }
  | { event: "meeting_scheduled"; page: string }
  | { event: "consent_update"; consent_analytics: boolean; consent_marketing: boolean };

export type AnalyticsEventName = AnalyticsEvent["event"];

/** Chaves que NUNCA podem aparecer em um evento (PII — PRD §40, §44). */
export const FORBIDDEN_KEYS = new Set([
  "name",
  "nome",
  "email",
  "e-mail",
  "phone",
  "telefone",
  "whatsapp",
  "company",
  "empresa",
  "role",
  "cargo",
  "description",
  "descricao",
  "message",
  "mensagem",
  "lead_score",
  "score",
]);

export const ALLOWED_EVENTS: ReadonlySet<AnalyticsEventName> = new Set<AnalyticsEventName>([
  "page_view",
  "cta_click",
  "solution_view",
  "case_view",
  "form_start",
  "form_step_complete",
  "form_error",
  "generate_lead",
  "schedule_start",
  "meeting_scheduled",
  "consent_update",
]);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Valida um payload antes do push. Lança em dev; em prod, apenas ignora o evento inválido. */
export function assertSafeEvent(payload: Record<string, unknown>): string | null {
  if (typeof payload.event !== "string" || !ALLOWED_EVENTS.has(payload.event as AnalyticsEventName)) {
    return `Evento não permitido: ${String(payload.event)}`;
  }
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return `Parâmetro proibido (PII): ${key}`;
    const value = payload[key];
    if (typeof value === "string" && /@|\b\d{2}\s?9?\d{4}-?\d{4}\b/.test(value) && key !== "page") {
      return `Valor com aparência de PII no parâmetro: ${key}`;
    }
  }
  return null;
}

/** Envia um evento tipado ao dataLayer (no-op no servidor). */
export function track(payload: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  const problem = assertSafeEvent(payload as unknown as Record<string, unknown>);
  if (problem) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[analytics] ${problem}`);
    }
    return;
  }
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ ...payload });
}

/** Atalho para CTAs — usa o pathname atual como `page`. */
export function trackCta(cta_id: string, cta_location: string, intent: CtaIntent): void {
  if (typeof window === "undefined") return;
  track({ event: "cta_click", cta_id, cta_location, page: window.location.pathname, intent });
}
