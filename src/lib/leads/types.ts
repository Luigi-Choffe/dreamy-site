import type { LeadBucket, UrgencyBucket } from "@/lib/analytics/events";
import type { InvestmentValue, NeedValue, UrgencyValue } from "./schema";

/** Modelo de dados do lead (PRD §40). PII restrita ao fluxo comercial. */
export interface LeadRecord {
  lead_id: string;
  created_at: string; // ISO
  request_id: string;
  submission_id: string;
  nome: string;
  email: string;
  telefone: string; // dígitos com DDI
  empresa: string;
  cargo: string;
  necessidade: NeedValue;
  descricao: string;
  urgencia: UrgencyValue;
  investimento: InvestmentValue | "";
  lead_score: number;
  lead_bucket: LeadBucket;
  urgency_bucket: UrgencyBucket;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  page: string | null;
  source: "website";
}

export type DeliveryStatus = "ok" | "failed" | "skipped";

export interface DeliveryResult {
  crm: DeliveryStatus;
  notification: DeliveryStatus;
  store: DeliveryStatus;
  errors: string[];
}
