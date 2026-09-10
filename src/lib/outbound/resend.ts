/**
 * Cliente Resend via REST (fetch, sem SDK — mesmo padrão de `src/lib/email/index.ts`, ADR-011).
 * Endpoints usados: POST /emails/batch (envio), GET /emails/:id (sync por polling),
 * POST /emails/:id/cancel (circuit breaker cancela agendados).
 */

const BASE = "https://api.resend.com";
const TIMEOUT_MS = 15_000;

export interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  /** Um endereço (string) ou vários (array) — a API do Resend aceita os dois. */
  reply_to?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  scheduled_at?: string;
}

export interface ResendEmailStatus {
  id: string;
  /** ex.: sent, delivered, delivery_delayed, bounced, complained, opened, clicked, canceled, failed, scheduled */
  last_event: string | null;
}

export class ResendApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Resend HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = "ResendApiError";
  }
}

async function request(
  apiKey: string,
  method: "GET" | "POST",
  pathName: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new ResendApiError(res.status, text);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export interface ResendClient {
  /** Até 100 e-mails por chamada. Retorna ids na mesma ordem do payload. */
  sendBatch(emails: ResendEmailPayload[], idempotencyKey: string): Promise<string[]>;
  getEmail(emailId: string): Promise<ResendEmailStatus>;
  cancelEmail(emailId: string): Promise<void>;
}

export function createResendClient(apiKey: string): ResendClient {
  return {
    async sendBatch(emails, idempotencyKey) {
      if (emails.length === 0) return [];
      if (emails.length > 100) throw new Error("Batch Resend aceita no máximo 100 e-mails.");
      const res = (await request(apiKey, "POST", "/emails/batch", emails, {
        "idempotency-key": idempotencyKey,
      })) as { data?: Array<{ id: string }> } | null;
      const ids = res?.data?.map((d) => d.id) ?? [];
      if (ids.length !== emails.length) {
        throw new Error(`Batch retornou ${ids.length} ids para ${emails.length} e-mails.`);
      }
      return ids;
    },

    async getEmail(emailId) {
      const res = (await request(apiKey, "GET", `/emails/${emailId}`)) as {
        id?: string;
        last_event?: string | null;
      } | null;
      return { id: res?.id ?? emailId, last_event: res?.last_event ?? null };
    },

    async cancelEmail(emailId) {
      await request(apiKey, "POST", `/emails/${emailId}/cancel`);
    },
  };
}
