import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionSecret,
  isAllowedEmail,
  isAuthDisabled,
  isProductionRuntime,
  LOGIN_PATH,
  SESSION_COOKIE,
  verifySession,
} from "@/lib/outbound/auth";

/**
 * Guard do console interno (PRD-EMAIL-OUTBOUND §16): `/interno/*` e `/api/outbound/*`
 * exigem o cookie de sessão assinado. Checagem OTIMISTA — assinatura, validade e
 * allowlist, sem I/O — lida de `request.cookies`; cada página/action/handler
 * revalida com `requireSession()` (Server Functions são POSTs na própria rota,
 * portanto passam por aqui, mas o guard de verdade é o delas).
 *
 * Liberadas: o próprio fluxo de login (`/interno/login`, `/interno/logout`,
 * `/api/outbound/auth/*`). `OUTBOUND_AUTH_DISABLED=true` libera tudo — só fora
 * de produção (a checagem vive em `isAuthDisabled`).
 */
export const config = {
  matcher: ["/interno/:path*", "/api/outbound/:path*"],
};

function isPublicConsolePath(pathname: string): boolean {
  return (
    pathname === "/interno/login" ||
    pathname.startsWith("/interno/login/") ||
    pathname === "/interno/logout" ||
    pathname.startsWith("/api/outbound/auth/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicConsolePath(pathname) || isAuthDisabled()) return NextResponse.next();

  const secret = getSessionSecret();
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = secret && raw ? verifySession(raw, secret) : null;
  if (session && isAllowedEmail(session.email)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, code: "unauthorized", message: "Sessão do console necessária." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  // 303 em POST (ex.: Server Action com sessão expirada) para o browser seguir com GET.
  const status = request.method === "GET" || request.method === "HEAD" ? 307 : 303;
  const response = NextResponse.redirect(login, status);
  response.headers.set("cache-control", "no-store");
  // Cookie presente mas inválido/expirado/revogado: limpa para não ficar em loop
  // (mesmos atributos do cookie real, para o browser casar a remoção).
  if (raw) {
    response.cookies.set(SESSION_COOKIE, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProductionRuntime(),
    });
  }
  return response;
}
