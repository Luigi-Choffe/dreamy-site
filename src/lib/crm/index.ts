import { logger } from "@/lib/observability/logger";
import type { LeadRecord } from "@/lib/leads/types";

/**
 * CRMProvider (PRD §41): interface desacoplada. Trocar de CRM = nova implementação
 * + `CRM_PROVIDER` no ambiente. O formulário não muda.
 */
export interface CRMProvider {
  readonly name: string;
  /** Deve lançar em caso de falha (o serviço decide o que fazer). */
  send(lead: LeadRecord, ctx: { requestId: string }): Promise<void>;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

async function postWithRetry(url: string, body: unknown, headers: Record<string, string>, requestId: string) {
  const attempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let retryable = true;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": requestId, ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return;
      const text = await res.text().catch(() => "");
      lastError = new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      retryable = RETRYABLE_STATUS.has(res.status);
    } catch (err) {
      // erro de rede/timeout: tenta novamente
      lastError = err;
    }
    if (!retryable) break;
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Webhook JSON genérico (Zapier, Make, n8n, HubSpot/RD/Pipedrive via automação, etc.). */
export function createWebhookCrmProvider(url: string, apiKey?: string): CRMProvider {
  return {
    name: "webhook",
    async send(lead, ctx) {
      const headers: Record<string, string> = {};
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      await postWithRetry(url, { type: "lead.created", lead }, headers, ctx.requestId);
    },
  };
}

/** Sem CRM configurado: registra aviso (erro observável em produção) e segue. */
export function createNoneCrmProvider(): CRMProvider {
  return {
    name: "none",
    async send(lead, ctx) {
      logger.warn("crm.not_configured", { requestId: ctx.requestId, leadId: lead.lead_id });
    },
  };
}

export function createCrmProvider(): CRMProvider {
  const provider = (process.env.CRM_PROVIDER ?? "none").toLowerCase();
  if (provider === "webhook") {
    const url = process.env.CRM_WEBHOOK_URL;
    if (!url) {
      logger.error("crm.misconfigured", { reason: "CRM_PROVIDER=webhook sem CRM_WEBHOOK_URL" });
      return createNoneCrmProvider();
    }
    return createWebhookCrmProvider(url, process.env.CRM_API_KEY);
  }
  return createNoneCrmProvider();
}
