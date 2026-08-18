import type { LeadBucket, UrgencyBucket } from "@/lib/analytics/events";
import type { InvestmentValue, LeadInput, NeedValue, UrgencyValue } from "./schema";

/**
 * Lead scoring (PRD §38) — SOMENTE server-side, configurável em um único lugar.
 * O score nunca é exposto ao visitante; apenas o bucket vai para analytics.
 * Máximo: 100 pontos.
 */
export const scoringConfig = {
  executiveRole: {
    points: 20,
    keywords: [
      "ceo",
      "coo",
      "cto",
      "cfo",
      "cmo",
      "cio",
      "cro",
      "founder",
      "fundador",
      "fundadora",
      "cofundador",
      "co-fundador",
      "sócio",
      "socio",
      "sócia",
      "socia",
      "presidente",
      "vice-presidente",
      "vp",
      "diretor",
      "diretora",
      "director",
      "head",
      "owner",
      "proprietário",
      "proprietaria",
      "proprietária",
      "dono",
      "dona",
      "gerente geral",
      "gerente-geral",
      "superintendente",
    ],
  },
  /**
   * Proxy inicial de "empresa no ICP" (PRD §8): e-mail corporativo (domínio não gratuito).
   * Refinar com enriquecimento futuro (porte, setor). Não é requisito público.
   */
  icpCompany: { points: 20 },
  urgencyWithin90Days: { points: 20, values: ["agora", "30-dias", "1-3-meses"] as UrgencyValue[] },
  detailedPain: { points: 15, minLength: 120 },
  investmentAtLeast20k: {
    points: 15,
    values: ["20-50k", "50-100k", "100-250k", "250k-mais"] as InvestmentValue[],
  },
  identifiedSolution: { points: 10, values: ["nova-receita", "sistema", "agente-ia"] as NeedValue[] },
  buckets: { alta: 75, media: 50 },
} as const;

export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "live.com.br",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "zoho.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "globomail.com",
  "r7.com",
  "oi.com.br",
  "gmx.com",
  "mail.com",
  "yandex.com",
]);

export function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

export function isCorporateEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain.length > 0 && !FREE_EMAIL_DOMAINS.has(domain);
}

export function isExecutiveRole(role: string): boolean {
  const r = role.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return scoringConfig.executiveRole.keywords.some((k) => {
    const kw = k.normalize("NFD").replace(/[̀-ͯ]/g, "");
    // palavra inteira (evita "vp" casar com "supervisor")
    return new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(r);
  });
}

export interface ScoreBreakdown {
  executiveRole: number;
  icpCompany: number;
  urgency: number;
  detailedPain: number;
  investment: number;
  identifiedSolution: number;
}

export interface LeadScore {
  score: number;
  bucket: LeadBucket;
  breakdown: ScoreBreakdown;
}

export function scoreLead(
  input: Pick<LeadInput, "role" | "email" | "urgency" | "description" | "investment" | "need">,
): LeadScore {
  const c = scoringConfig;
  const breakdown: ScoreBreakdown = {
    executiveRole: isExecutiveRole(input.role) ? c.executiveRole.points : 0,
    icpCompany: isCorporateEmail(input.email) ? c.icpCompany.points : 0,
    urgency: c.urgencyWithin90Days.values.includes(input.urgency) ? c.urgencyWithin90Days.points : 0,
    detailedPain: input.description.length >= c.detailedPain.minLength ? c.detailedPain.points : 0,
    investment:
      input.investment && c.investmentAtLeast20k.values.includes(input.investment as InvestmentValue)
        ? c.investmentAtLeast20k.points
        : 0,
    identifiedSolution: c.identifiedSolution.values.includes(input.need) ? c.identifiedSolution.points : 0,
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score, bucket: bucketFor(score), breakdown };
}

export function bucketFor(score: number): LeadBucket {
  if (score >= scoringConfig.buckets.alta) return "alta";
  if (score >= scoringConfig.buckets.media) return "media";
  return "avaliacao";
}

export function urgencyBucket(urgency: UrgencyValue): UrgencyBucket {
  switch (urgency) {
    case "agora":
    case "30-dias":
      return "ate_30d";
    case "1-3-meses":
      return "1_3m";
    case "3-6-meses":
      return "3_6m";
    default:
      return "pesquisando";
  }
}

export const MAX_SCORE =
  scoringConfig.executiveRole.points +
  scoringConfig.icpCompany.points +
  scoringConfig.urgencyWithin90Days.points +
  scoringConfig.detailedPain.points +
  scoringConfig.investmentAtLeast20k.points +
  scoringConfig.identifiedSolution.points;
