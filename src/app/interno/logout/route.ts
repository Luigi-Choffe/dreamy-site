import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/observability/logger";
import { clearSessionCookie, CONSOLE_HOME, LOGIN_PATH } from "@/lib/outbound/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("cache-control", "no-store");
  return response;
}

/** POST /interno/logout — encerra a sessão (form "Sair" do console) e volta ao login. */
export async function POST(request: NextRequest) {
  await clearSessionCookie();
  logger.info("outbound.auth.logout");
  return redirectTo(request, LOGIN_PATH);
}

/** GET direto na URL não encerra sessão (sem CSRF de logout): só manda ao console. */
export async function GET(request: NextRequest) {
  return redirectTo(request, CONSOLE_HOME);
}
