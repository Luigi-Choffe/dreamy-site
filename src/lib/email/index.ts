import { logger } from "@/lib/observability/logger";
import type { LeadRecord } from "@/lib/leads/types";

/**
 * NotificationProvider (PRD §41): e-mail de novo lead para a equipe comercial.
 * Implementações: `resend` (REST via fetch, sem SDK) e `none`.
 */
export interface NotificationProvider {
  readonly name: string;
  notifyNewLead(lead: LeadRecord, ctx: { requestId: string }): Promise<void>;
}

const LABELS: Record<string, string> = {
  "nova-receita": "Quero criar uma nova fonte de receita",
  sistema: "Preciso desenvolver um sistema",
  "agente-ia": "Quero aplicar IA na empresa",
  "nao-sei": "Tenho uma dor, mas ainda não sei qual solução preciso",
  outro: "Outro",
  agora: "Agora",
  "30-dias": "Próximos 30 dias",
  "1-3-meses": "1–3 meses",
  "3-6-meses": "3–6 meses",
  pesquisando: "Apenas pesquisando",
  "ate-20k": "Até R$ 20 mil",
  "20-50k": "R$ 20–50 mil",
  "50-100k": "R$ 50–100 mil",
  "100-250k": "R$ 100–250 mil",
  "250k-mais": "Acima de R$ 250 mil",
  indefinido: "Ainda não definimos",
  alta: "ALTA",
  media: "MÉDIA",
  avaliacao: "AVALIAÇÃO",
};

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Corpo do e-mail interno (texto + HTML simples). Exportado para testes. */
export function renderLeadEmail(lead: LeadRecord): { subject: string; text: string; html: string } {
  const bucket = LABELS[lead.lead_bucket] ?? lead.lead_bucket;
  const subject = `[Lead ${bucket}] ${lead.empresa} — ${lead.nome} (${LABELS[lead.necessidade] ?? lead.necessidade})`;
  const rows: Array<[string, string]> = [
    ["Prioridade", `${bucket} (score ${lead.lead_score})`],
    ["Nome", lead.nome],
    ["Empresa", lead.empresa],
    ["Cargo", lead.cargo],
    ["E-mail", lead.email],
    ["WhatsApp/telefone", `+${lead.telefone}`],
    ["Situação", LABELS[lead.necessidade] ?? lead.necessidade],
    ["Urgência", LABELS[lead.urgencia] ?? lead.urgencia],
    ["Investimento", lead.investimento ? (LABELS[lead.investimento] ?? lead.investimento) : "não informado"],
    ["Descrição", lead.descricao],
    ["Origem", [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ") || "direto/orgânico"],
    ["Landing page", lead.landing_page ?? "-"],
    ["Referrer", lead.referrer ?? "-"],
    ["Página do envio", lead.page ?? "-"],
    ["Lead ID", lead.lead_id],
    ["Recebido em", lead.created_at],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:system-ui,sans-serif;color:#0b0b0c">
<h2 style="margin:0 0 12px">Novo lead pelo site</h2>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="color:#575c61;vertical-align:top;white-space:nowrap"><b>${esc(k)}</b></td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join("\n")}
</table></body></html>`;
  return { subject, text, html };
}

export function createResendProvider(apiKey: string, to: string, from: string): NotificationProvider {
  return {
    name: "resend",
    async notifyNewLead(lead, ctx) {
      const { subject, text, html } = renderLeadEmail(lead);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: to
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          reply_to: lead.email,
          subject,
          text,
          html,
          headers: { "X-Entity-Ref-ID": lead.lead_id, "X-Request-ID": ctx.requestId },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Resend HTTP ${res.status} ${body.slice(0, 200)}`);
      }
    },
  };
}

export function createNoneNotificationProvider(): NotificationProvider {
  return {
    name: "none",
    async notifyNewLead(lead, ctx) {
      logger.warn("notification.not_configured", { requestId: ctx.requestId, leadId: lead.lead_id });
    },
  };
}

export function createNotificationProvider(): NotificationProvider {
  const provider = (process.env.EMAIL_PROVIDER ?? "none").toLowerCase();
  if (provider === "resend") {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    const to = process.env.LEADS_NOTIFICATION_EMAIL;
    const from = process.env.LEADS_NOTIFICATION_FROM;
    if (!apiKey || !to || !from) {
      logger.error("notification.misconfigured", {
        reason:
          "EMAIL_PROVIDER=resend exige EMAIL_PROVIDER_API_KEY, LEADS_NOTIFICATION_EMAIL e LEADS_NOTIFICATION_FROM",
      });
      return createNoneNotificationProvider();
    }
    return createResendProvider(apiKey, to, from);
  }
  return createNoneNotificationProvider();
}
