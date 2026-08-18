import { randomUUID } from "node:crypto";
import { createCrmProvider, type CRMProvider } from "@/lib/crm";
import { createNotificationProvider, type NotificationProvider } from "@/lib/email";
import { logger, reportServerError } from "@/lib/observability/logger";
import { normalizePhone, type LeadInput } from "./schema";
import { emailDomain, scoreLead, urgencyBucket } from "./scoring";
import { createLeadStore, type LeadStore } from "./store";
import type { DeliveryResult, LeadRecord } from "./types";

/**
 * LeadService (PRD §41–§42): transforma input validado em LeadRecord, pontua e entrega
 * aos adapters. Regras: falha do CRM é erro observável; falha de e-mail não destrói
 * um lead entregue ao CRM; se nenhuma entrega funcionar, o chamador responde erro.
 */

export interface LeadServiceDeps {
  crm?: CRMProvider;
  notifier?: NotificationProvider;
  store?: LeadStore;
  now?: () => Date;
  id?: () => string;
}

/** Transformação pura (testável): input validado → registro (PRD §40). */
export function buildLeadRecord(input: LeadInput, meta: { requestId: string; now?: Date; id?: string }): LeadRecord {
  const { score, bucket } = scoreLead(input);
  const a = input.attribution ?? {};
  return {
    lead_id: meta.id ?? randomUUID(),
    created_at: (meta.now ?? new Date()).toISOString(),
    request_id: meta.requestId,
    submission_id: input.submissionId,
    nome: input.name,
    email: input.email,
    telefone: normalizePhone(input.phone),
    empresa: input.company,
    cargo: input.role,
    necessidade: input.need,
    descricao: input.description,
    urgencia: input.urgency,
    investimento: input.investment ?? "",
    lead_score: score,
    lead_bucket: bucket,
    urgency_bucket: urgencyBucket(input.urgency),
    landing_page: a.landing_page ?? null,
    referrer: a.referrer ?? null,
    utm_source: a.utm_source ?? null,
    utm_medium: a.utm_medium ?? null,
    utm_campaign: a.utm_campaign ?? null,
    utm_content: a.utm_content ?? null,
    utm_term: a.utm_term ?? null,
    page: input.page ?? null,
    source: "website",
  };
}

export function createLeadService(deps: LeadServiceDeps = {}) {
  const crm = deps.crm ?? createCrmProvider();
  const notifier = deps.notifier ?? createNotificationProvider();
  const store = deps.store ?? createLeadStore();

  return {
    async process(input: LeadInput, requestId: string): Promise<{ lead: LeadRecord; delivery: DeliveryResult }> {
      const lead = buildLeadRecord(input, { requestId, now: deps.now?.(), id: deps.id?.() });
      const delivery: DeliveryResult = { crm: "skipped", notification: "skipped", store: "skipped", errors: [] };
      const ctx = { requestId };
      const safe = { requestId, leadId: lead.lead_id, bucket: lead.lead_bucket, domain: emailDomain(lead.email) };

      // 1) CRM (canal principal)
      if (crm.name === "none") {
        delivery.crm = "skipped";
      } else {
        try {
          await crm.send(lead, ctx);
          delivery.crm = "ok";
        } catch (err) {
          delivery.crm = "failed";
          delivery.errors.push(`crm:${crm.name}`);
          reportServerError("lead.crm_failed", err, { ...safe, provider: crm.name });
        }
      }

      // 2) Notificação (não destrói lead entregue ao CRM)
      if (notifier.name === "none") {
        delivery.notification = "skipped";
      } else {
        try {
          await notifier.notifyNewLead(lead, ctx);
          delivery.notification = "ok";
        } catch (err) {
          delivery.notification = "failed";
          delivery.errors.push(`notification:${notifier.name}`);
          reportServerError("lead.notification_failed", err, { ...safe, provider: notifier.name });
        }
      }

      // 3) Store local/auditoria (opcional)
      try {
        const stored = await store.save(lead);
        delivery.store = stored ? "ok" : "skipped";
      } catch (err) {
        delivery.store = "failed";
        reportServerError("lead.store_failed", err, safe);
      }

      const delivered = delivery.crm === "ok" || delivery.notification === "ok" || delivery.store === "ok";
      if (!delivered && (delivery.crm === "failed" || delivery.notification === "failed")) {
        // última instância: registra o lead completo no log para recuperação manual
        logger.error("lead.delivery_failed_all", { ...safe, lead });
      } else {
        logger.info("lead.processed", { ...safe, delivery: { ...delivery, errors: undefined } });
      }

      return { lead, delivery };
    },
  };
}

export type LeadService = ReturnType<typeof createLeadService>;
