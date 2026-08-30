import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/observability/logger";
import {
  CONSOLE_HOME,
  createSessionCookie,
  getSessionSecret,
  isAllowedEmail,
  LOGIN_PATH,
  safeNextPath,
  shortEmailHash,
  verifyLoginToken,
} from "@/lib/outbound/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("cache-control", "no-store");
  return response;
}

/**
 * GET /api/outbound/auth/callback?token=…[&next=…] — troca o token do link de
 * acesso (15 min) por cookie de sessão e leva ao console (ou ao `next` interno).
 * Token inválido/expirado ou e-mail já fora da allowlist → login com aviso.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? undefined;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const secret = getSessionSecret();
  const payload = secret ? verifyLoginToken(token, secret) : null;
  if (!payload || !isAllowedEmail(payload.email)) {
    logger.info("outbound.auth.callback", { result: "rejected" });
    return redirectTo(request, `${LOGIN_PATH}?error=expirado`);
  }

  await createSessionCookie(payload.email);
  logger.info("outbound.auth.callback", { result: "ok", emailHash: shortEmailHash(payload.email) });
  return redirectTo(request, next ?? CONSOLE_HOME);
}
