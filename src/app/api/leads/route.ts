import { NextResponse } from "next/server";
import { fieldErrors, leadInputSchema, MAX_PAYLOAD_BYTES, MIN_FILL_TIME_MS } from "@/lib/leads/schema";
import { createLeadService } from "@/lib/leads/service";
import { logger, reportServerError } from "@/lib/observability/logger";
import { getLeadIdempotencyStore } from "@/lib/security/idempotency";
import { getLeadRateLimiter } from "@/lib/security/rate-limit";
import { getClientIp, getRequestId } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resposta pública do endpoint (sem PII, sem score numérico — PRD §38). */
export interface LeadApiSuccess {
  ok: true;
  requestId: string;
  leadBucket: "alta" | "media" | "avaliacao";
  urgencyBucket: "ate_30d" | "1_3m" | "3_6m" | "pesquisando";
  solution: string;
}
export interface LeadApiError {
  ok: false;
  requestId: string;
  code:
    | "invalid_json"
    | "validation"
    | "rate_limited"
    | "payload_too_large"
    | "captcha_failed"
    | "delivery_failed"
    | "server_error";
  errors?: Record<string, string>;
  message?: string;
}

const idempotency = getLeadIdempotencyStore<LeadApiSuccess>();
let service: ReturnType<typeof createLeadService> | null = null;
function getService() {
  if (!service) service = createLeadService();
  return service;
}

function json<T>(body: T, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/**
 * POST /api/leads — recebe o formulário de contato (PRD §37, §41–§42, §75).
 * Ordem: tamanho → JSON → honeypot → validação → rate limit → idempotência → Turnstile → tempo mínimo → serviço.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  const ip = getClientIp(request.headers);

  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_PAYLOAD_BYTES) {
      return json<LeadApiError>({ ok: false, requestId, code: "payload_too_large" }, 413);
    }

    const raw = await request.text();
    if (raw.length > MAX_PAYLOAD_BYTES) {
      return json<LeadApiError>({ ok: false, requestId, code: "payload_too_large" }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json<LeadApiError>({ ok: false, requestId, code: "invalid_json" }, 400);
    }

    // Honeypot: bots preenchem "website". Responde sucesso silencioso e não processa.
    if (
      body &&
      typeof body === "object" &&
      typeof (body as { website?: unknown }).website === "string" &&
      (body as { website: string }).website.trim() !== ""
    ) {
      logger.warn("lead.honeypot", { requestId, ip });
      return json<LeadApiSuccess>({
        ok: true,
        requestId,
        leadBucket: "avaliacao",
        urgencyBucket: "pesquisando",
        solution: "spam",
      });
    }

    const parsed = leadInputSchema.safeParse(body);
    if (!parsed.success) {
      return json<LeadApiError>({ ok: false, requestId, code: "validation", errors: fieldErrors(parsed.error) }, 400);
    }
    const input = parsed.data;

    const limit = await getLeadRateLimiter().check(ip);
    if (!limit.allowed) {
      logger.warn("lead.rate_limited", { requestId, ip });
      return json<LeadApiError>({ ok: false, requestId, code: "rate_limited" }, 429, {
        "retry-after": String(limit.retryAfterSec),
      });
    }

    const cached = await idempotency.get(input.submissionId);
    if (cached) {
      logger.info("lead.idempotent_replay", { requestId, submissionId: input.submissionId });
      return json<LeadApiSuccess>({ ...cached, requestId });
    }
    if (!(await idempotency.reserve(input.submissionId))) {
      // envio simultâneo com o mesmo submissionId: trata como sucesso em andamento
      return json<LeadApiError>({ ok: false, requestId, code: "server_error", message: "Envio em andamento." }, 409);
    }

    try {
      const captchaOk = await verifyTurnstile(input.turnstileToken, ip);
      if (!captchaOk) {
        await idempotency.release(input.submissionId);
        return json<LeadApiError>({ ok: false, requestId, code: "captcha_failed" }, 400);
      }

      if (input.startedAt && Date.now() - input.startedAt < MIN_FILL_TIME_MS) {
        logger.warn("lead.too_fast", { requestId, ip, elapsedMs: Date.now() - input.startedAt });
        await idempotency.release(input.submissionId);
        return json<LeadApiSuccess>({
          ok: true,
          requestId,
          leadBucket: "avaliacao",
          urgencyBucket: "pesquisando",
          solution: "spam",
        });
      }

      const { lead, delivery } = await getService().process(input, requestId);

      const delivered = delivery.crm === "ok" || delivery.notification === "ok" || delivery.store === "ok";
      const attemptedAndFailed = delivery.crm === "failed" || delivery.notification === "failed";
      if (!delivered && attemptedAndFailed) {
        await idempotency.release(input.submissionId);
        return json<LeadApiError>({ ok: false, requestId, code: "delivery_failed" }, 502);
      }

      const success: LeadApiSuccess = {
        ok: true,
        requestId,
        leadBucket: lead.lead_bucket,
        urgencyBucket: lead.urgency_bucket,
        solution: lead.necessidade,
      };
      await idempotency.set(input.submissionId, success);
      return json(success);
    } catch (err) {
      await idempotency.release(input.submissionId);
      throw err;
    }
  } catch (err) {
    reportServerError("lead.unhandled", err, { requestId });
    // Nunca expor stack trace ao visitante (PRD §75)
    return json<LeadApiError>({ ok: false, requestId, code: "server_error" }, 500);
  }
}

export function GET() {
  return json({ ok: false, message: "Method not allowed" }, 405, { allow: "POST" });
}
