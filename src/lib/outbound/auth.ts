/**
 * Autenticação do console interno (PRD-EMAIL-OUTBOUND §16, §28.3).
 *
 * Link de acesso por e-mail (magic link), sem senha e sem dependência nova:
 * quem está em `OUTBOUND_TEAM_EMAILS` recebe um link com token assinado
 * (HMAC-SHA256 via `node:crypto`, 15 min); o callback troca o token por um cookie
 * de sessão assinado (30 dias, HttpOnly, Secure em produção, SameSite=Lax).
 *
 * Duas camadas neste módulo:
 * - PURA (sem APIs de request): `signSession`/`verifySession`,
 *   `signLoginToken`/`verifyLoginToken`, `isAllowedEmail`, `isAuthDisabled`,
 *   `safeNextPath` — usadas por `src/proxy.ts`, pelos testes e pelo e2e.
 * - DE REQUEST (`cookies()`/`redirect()`): `getSession`, `requireSession`,
 *   `createSessionCookie`, `clearSessionCookie` — só em Server Components,
 *   Server Functions e Route Handlers.
 *
 * Regras: nunca revelar se um e-mail está na lista (resposta idêntica); logs sem
 * PII (hash curto do e-mail); `OUTBOUND_AUTH_DISABLED=true` só vale fora de
 * produção; sem `OUTBOUND_SESSION_SECRET` tudo falha FECHADO (ninguém entra) e o
 * log explica o que falta.
 *
 * Envs: OUTBOUND_TEAM_EMAILS · OUTBOUND_SESSION_SECRET · OUTBOUND_APP_URL ·
 * OUTBOUND_AUTH_DISABLED · (envio do link) OUTBOUND_RESEND_API_KEY + OUTBOUND_FROM.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logger, reportServerError } from "@/lib/observability/logger";
import { getKvClient } from "@/lib/security/kv";
import { createKvRateLimiter, createMemoryRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";
import { getOutboundEnv } from "./config";
import { createResendClient } from "./resend";
import { SIGNATURE } from "./signature";

export const SESSION_COOKIE = "mork_session";
export const LOGIN_PATH = "/interno/login";
export const CONSOLE_HOME = "/interno/outbound";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Identidade fixa quando o bypass de desenvolvimento está ativo. */
export const DEV_SESSION_EMAIL = "dev@local";
export const LOGIN_EMAIL_SUBJECT = "Seu acesso ao console da Dreamy";

export interface Session {
  email: string;
}

// ─── Ambiente ────────────────────────────────────────────────────────────────

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Bypass de auth para dev local e demo — NUNCA em produção, mesmo com a env ligada. */
export function isAuthDisabled(): boolean {
  return process.env.OUTBOUND_AUTH_DISABLED === "true" && !isProductionRuntime();
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Lista de e-mails autorizados (`OUTBOUND_TEAM_EMAILS`, separados por vírgula). */
export function allowedEmails(): string[] {
  return (process.env.OUTBOUND_TEAM_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((email) => email !== "");
}

export function isAllowedEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized !== "" && allowedEmails().includes(normalized);
}

let warnedMissingSecret = false;

/**
 * Segredo que assina sessões e tokens. Obrigatório em produção; sem ele nada é
 * assinado nem verificado (fail-closed) e o log diz como resolver.
 */
export function getSessionSecret(): string | null {
  const secret = process.env.OUTBOUND_SESSION_SECRET?.trim();
  if (secret) return secret;
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    logger.error("outbound.auth.secret_ausente", {
      hint: "defina OUTBOUND_SESSION_SECRET (ex.: openssl rand -base64 32); fora de produção, OUTBOUND_AUTH_DISABLED=true libera o console sem login",
    });
  }
  return null;
}

/** Hash curto para correlacionar logs sem expor o e-mail (PRD §79). */
export function shortEmailHash(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 12);
}

// ─── Tokens assinados (puro) ─────────────────────────────────────────────────
//
// Formato: base64url(JSON {email, exp}) + "." + base64url(HMAC-SHA256).
// O HMAC cobre `${purpose}.${payload}`: um token de login nunca vale como cookie
// de sessão (nem o contrário), mesmo assinados com o mesmo segredo.

type TokenPurpose = "session" | "login";

const B64URL_RE = /^[A-Za-z0-9_-]+$/;

function hmac(purpose: TokenPurpose, payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${purpose}.${payload}`).digest("base64url");
}

function signToken(purpose: TokenPurpose, email: string, secret: string, ttlMs: number): string {
  if (!secret) throw new Error("Segredo de sessão ausente (OUTBOUND_SESSION_SECRET).");
  const payload = Buffer.from(JSON.stringify({ email: normalizeEmail(email), exp: Date.now() + ttlMs })).toString(
    "base64url",
  );
  return `${payload}.${hmac(purpose, payload, secret)}`;
}

function verifyToken(purpose: TokenPurpose, value: string | undefined, secret: string, now: number): Session | null {
  if (!secret || typeof value !== "string") return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  if (!B64URL_RE.test(payload) || !B64URL_RE.test(signature)) return null;

  const expected = Buffer.from(hmac(purpose, payload, secret), "base64url");
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { email, exp } = parsed as { email?: unknown; exp?: unknown };
  if (typeof email !== "string" || email === "") return null;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= now) return null;
  return { email };
}

/** Cookie de sessão (30 dias por padrão). */
export function signSession(email: string, secret: string, ttlMs = SESSION_TTL_MS): string {
  return signToken("session", email, secret, ttlMs);
}

/** Verifica assinatura (timing-safe) e validade; `now` é injetável para testes. */
export function verifySession(value: string | undefined, secret: string, now = Date.now()): Session | null {
  return verifyToken("session", value, secret, now);
}

/** Token do link de acesso — 15 minutos. */
export function signLoginToken(email: string, secret: string): string {
  return signToken("login", email, secret, LOGIN_TOKEN_TTL_MS);
}

export function verifyLoginToken(token: string | undefined, secret: string, now = Date.now()): Session | null {
  return verifyToken("login", token, secret, now);
}

/**
 * Destino pós-login vindo de `?next=`: só caminhos internos do console
 * (`/interno/...`), nunca URL absoluta/protocol-relative nem o próprio fluxo de login.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 512 || !raw.startsWith("/interno/")) return null;
  let url: URL;
  try {
    url = new URL(raw, "http://console.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://console.invalid") return null;
  const path = `${url.pathname}${url.search}`;
  if (!path.startsWith("/interno/")) return null;
  if (path.startsWith("/interno/login") || path.startsWith("/interno/logout")) return null;
  return path;
}

// ─── Sessão (APIs de request) ────────────────────────────────────────────────

function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: isProductionRuntime(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
    expires: new Date(Date.now() + maxAgeSec * 1000),
  };
}

/** Abre a sessão (Server Function ou Route Handler). Lança sem segredo — nunca abre sessão não assinada. */
export async function createSessionCookie(email: string): Promise<void> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("OUTBOUND_SESSION_SECRET ausente: não é possível abrir sessão.");
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(email, secret), sessionCookieOptions(SESSION_TTL_MS / 1000));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

/**
 * Sessão da request atual (memoizada por render). `null` sem cookie válido ou se o
 * e-mail saiu da allowlist (revogação imediata, mesmo com cookie de 30 dias).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (isAuthDisabled()) return { email: DEV_SESSION_EMAIL };
  const secret = getSessionSecret();
  if (!secret) return null;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const session = verifySession(value, secret);
  if (!session || !isAllowedEmail(session.email)) return null;
  return session;
});

/** Guard das páginas e actions do console: sem sessão, redireciona para o login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

// ─── Link de acesso ──────────────────────────────────────────────────────────

const LOGIN_LINK_LIMIT = 5;
const LOGIN_LINK_WINDOW_MS = 15 * 60 * 1000;

let loginLimiter: RateLimiter | null = null;

/** 5 links por e-mail (e por IP) a cada 15 min — reutiliza o rate limit do site (PRD §16). */
function getLoginRateLimiter(): RateLimiter {
  if (!loginLimiter) {
    const kv = getKvClient();
    loginLimiter = kv
      ? createKvRateLimiter({ limit: LOGIN_LINK_LIMIT, windowMs: LOGIN_LINK_WINDOW_MS, kv, prefix: "dreamy:rl:login" })
      : createMemoryRateLimiter({ limit: LOGIN_LINK_LIMIT, windowMs: LOGIN_LINK_WINDOW_MS });
  }
  return loginLimiter;
}

/** Base pública dos links: `OUTBOUND_APP_URL` quando definida; senão a origem da request. */
export function appBaseUrl(requestOrigin: string): string {
  const configured = process.env.OUTBOUND_APP_URL?.trim();
  for (const candidate of [configured, requestOrigin]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    } catch {
      // candidato inválido — tenta o próximo
    }
  }
  return requestOrigin.replace(/\/+$/, "");
}

export function buildLoginLinkUrl(base: string, token: string, next?: string | null): string {
  const url = new URL(`${base.replace(/\/+$/, "")}/api/outbound/auth/callback`);
  url.searchParams.set("token", token);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export function loginEmailText(url: string): string {
  return [
    "Olá,",
    "",
    "Aqui está o seu link de acesso ao console da Dreamy. Ele vale por 15 minutos:",
    "",
    url,
    "",
    "Se você não pediu este acesso, pode ignorar esta mensagem.",
    "",
    "Dreamy · console interno",
  ].join("\n");
}

export interface SendLoginLinkOptions {
  /** Destino pós-login já validado por `safeNextPath`. */
  next?: string | null;
  /** IP do cliente — só para rate limit. */
  ip?: string;
}

/**
 * Envia o link de acesso se (e só se) o e-mail estiver na allowlist. O retorno é
 * IDÊNTICO em todos os caminhos (void, sem lançar) — quem chama nunca descobre se o
 * e-mail é autorizado. Falhas viram log sem PII.
 */
export async function sendLoginLink(rawEmail: string, origin: string, opts: SendLoginLinkOptions = {}): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const emailHash = email ? shortEmailHash(email) : "vazio";
  if (!isAllowedEmail(email)) {
    logger.info("outbound.auth.login_link", { result: "ignored", emailHash });
    return;
  }
  const secret = getSessionSecret();
  if (!secret) {
    logger.warn("outbound.auth.login_link", { result: "skipped", reason: "sem_segredo", emailHash });
    return;
  }
  const env = getOutboundEnv();
  if (!env.apiKey || !env.from) {
    logger.warn("outbound.auth.login_link", {
      result: "skipped",
      reason: "sem_resend",
      hint: "defina OUTBOUND_RESEND_API_KEY e OUTBOUND_FROM",
      emailHash,
    });
    return;
  }
  const limiter = getLoginRateLimiter();
  const byEmail = await limiter.check(`email:${emailHash}`);
  const byIp = opts.ip ? await limiter.check(`ip:${opts.ip}`) : null;
  if (!byEmail.allowed || (byIp && !byIp.allowed)) {
    logger.warn("outbound.auth.login_link", { result: "rate_limited", emailHash });
    return;
  }
  if (!process.env.OUTBOUND_APP_URL?.trim() && isProductionRuntime()) {
    logger.warn("outbound.auth.app_url_ausente", {
      hint: "defina OUTBOUND_APP_URL para fixar a base dos links (hoje: origem da request)",
    });
  }

  try {
    const url = buildLoginLinkUrl(appBaseUrl(origin), signLoginToken(email, secret), opts.next);
    await createResendClient(env.apiKey).sendBatch(
      [
        {
          from: env.from,
          to: [email],
          subject: LOGIN_EMAIL_SUBJECT,
          text: loginEmailText(url),
          reply_to: SIGNATURE.email,
        },
      ],
      `console-login-${emailHash}-${Date.now()}`,
    );
    logger.info("outbound.auth.login_link", { result: "sent", emailHash });
  } catch (error) {
    reportServerError("outbound.auth.login_link_falhou", error, { emailHash });
  }
}
