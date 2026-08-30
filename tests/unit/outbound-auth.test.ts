import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  appBaseUrl,
  buildLoginLinkUrl,
  clearSessionCookie,
  createSessionCookie,
  DEV_SESSION_EMAIL,
  getSession,
  isAllowedEmail,
  isAuthDisabled,
  LOGIN_TOKEN_TTL_MS,
  requireSession,
  safeNextPath,
  sendLoginLink,
  SESSION_COOKIE,
  signLoginToken,
  signSession,
  verifyLoginToken,
  verifySession,
} from "@/lib/outbound/auth";
import { proxy } from "@/proxy";

/**
 * Auth do console (PRD-EMAIL-OUTBOUND §16): tokens HMAC puros, allowlist, bypass
 * de dev só fora de produção, sessão via cookie (next/headers mockado) e o guard
 * do proxy. Nenhum teste toca rede: o Resend é um `fetch` stubado.
 */

const { cookieJar, setCalls } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  setCalls: [] as Array<{ name: string; value: string; options?: Record<string, unknown> }>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      setCalls.push({ name, value, options });
      if (options?.maxAge === 0) cookieJar.delete(name);
      else cookieJar.set(name, value);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const SECRET = "segredo-de-teste-nao-use-em-producao";
const TEAM = "Luigi@Dreamy.app.br, outro@dreamy.app.br ,, ";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("OUTBOUND_AUTH_DISABLED", "");
  vi.stubEnv("OUTBOUND_SESSION_SECRET", SECRET);
  vi.stubEnv("OUTBOUND_TEAM_EMAILS", TEAM);
  vi.stubEnv("OUTBOUND_APP_URL", "");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cookieJar.clear();
  setCalls.length = 0;
});

describe("sessão assinada — signSession/verifySession", () => {
  it("assina e verifica {email} (normalizado) dentro da validade", () => {
    const token = signSession("  Luigi@Dreamy.app.br ", SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifySession(token, SECRET)).toEqual({ email: "luigi@dreamy.app.br" });
  });

  it("rejeita assinatura adulterada, payload forjado e segredo diferente", () => {
    const token = signSession("a@b.c", SECRET);
    const [payload, signature] = token.split(".") as [string, string];
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    expect(verifySession(`${payload}.${flipped}`, SECRET)).toBeNull();

    const forged = Buffer.from(JSON.stringify({ email: "x@y.z", exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifySession(`${forged}.${signature}`, SECRET)).toBeNull();

    expect(verifySession(token, "outro-segredo")).toBeNull();
    expect(verifySession(token, "")).toBeNull();
  });

  it("rejeita sessão expirada", () => {
    expect(verifySession(signSession("a@b.c", SECRET, -1), SECRET)).toBeNull();
    const token = signSession("a@b.c", SECRET, 1_000);
    expect(verifySession(token, SECRET, Date.now() + 2_000)).toBeNull();
    expect(verifySession(token, SECRET, Date.now() + 500)).toEqual({ email: "a@b.c" });
  });

  it("rejeita formatos inválidos sem lançar", () => {
    for (const bad of ["", "abc", "a.b.c", "a.b", "..", "%%%.%%%", "YQ.YQ"]) {
      expect(verifySession(bad, SECRET), bad).toBeNull();
    }
    expect(verifySession(undefined, SECRET)).toBeNull();
    // payload válido em base64url mas sem email/exp
    const junk = Buffer.from(JSON.stringify({ foo: 1 })).toString("base64url");
    expect(verifySession(`${junk}.${junk}`, SECRET)).toBeNull();
  });
});

describe("token de login — signLoginToken/verifyLoginToken", () => {
  it("vale 15 minutos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00Z"));
    const token = signLoginToken("a@b.c", SECRET);
    expect(verifyLoginToken(token, SECRET)).toEqual({ email: "a@b.c" });
    vi.setSystemTime(new Date("2026-08-30T12:00:00Z").getTime() + LOGIN_TOKEN_TTL_MS - 1);
    expect(verifyLoginToken(token, SECRET)).toEqual({ email: "a@b.c" });
    vi.setSystemTime(new Date("2026-08-30T12:00:00Z").getTime() + LOGIN_TOKEN_TTL_MS + 1);
    expect(verifyLoginToken(token, SECRET)).toBeNull();
  });

  it("não é intercambiável com o cookie de sessão (mesmo segredo)", () => {
    const login = signLoginToken("a@b.c", SECRET);
    const session = signSession("a@b.c", SECRET);
    expect(verifySession(login, SECRET)).toBeNull();
    expect(verifyLoginToken(session, SECRET)).toBeNull();
  });

  it("assinar sem segredo lança (nunca emite token não assinado)", () => {
    expect(() => signLoginToken("a@b.c", "")).toThrow(/OUTBOUND_SESSION_SECRET/);
    expect(() => signSession("a@b.c", "")).toThrow(/OUTBOUND_SESSION_SECRET/);
  });
});

describe("allowlist — OUTBOUND_TEAM_EMAILS", () => {
  it("ignora caixa e espaços; entradas vazias não contam", () => {
    expect(isAllowedEmail("luigi@dreamy.app.br")).toBe(true);
    expect(isAllowedEmail("  LUIGI@DREAMY.APP.BR ")).toBe(true);
    expect(isAllowedEmail("outro@dreamy.app.br")).toBe(true);
    expect(isAllowedEmail("nao@dreamy.app.br")).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
    expect(isAllowedEmail("   ")).toBe(false);
  });

  it("lista vazia ou ausente não autoriza ninguém", () => {
    vi.stubEnv("OUTBOUND_TEAM_EMAILS", "");
    expect(isAllowedEmail("luigi@dreamy.app.br")).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
  });
});

describe("OUTBOUND_AUTH_DISABLED — só fora de produção", () => {
  it("liga em development/test com o valor exato 'true'", () => {
    vi.stubEnv("OUTBOUND_AUTH_DISABLED", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isAuthDisabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "test");
    expect(isAuthDisabled()).toBe(true);
    vi.stubEnv("OUTBOUND_AUTH_DISABLED", "1");
    expect(isAuthDisabled()).toBe(false);
  });

  it("é ignorado em produção", () => {
    vi.stubEnv("OUTBOUND_AUTH_DISABLED", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAuthDisabled()).toBe(false);
  });

  it("getSession devolve dev@local quando ligado (sem cookie) e null em produção", async () => {
    vi.stubEnv("OUTBOUND_AUTH_DISABLED", "true");
    expect(await getSession()).toEqual({ email: DEV_SESSION_EMAIL });
    vi.stubEnv("NODE_ENV", "production");
    expect(await getSession()).toBeNull();
  });
});

describe("sessão via cookie — getSession/requireSession/createSessionCookie", () => {
  it("lê o cookie assinado e exige que o e-mail siga na allowlist", async () => {
    cookieJar.set(SESSION_COOKIE, signSession("luigi@dreamy.app.br", SECRET));
    expect(await getSession()).toEqual({ email: "luigi@dreamy.app.br" });
    expect(await requireSession()).toEqual({ email: "luigi@dreamy.app.br" });

    // Revogação: removeu da lista, cookie de 30 dias deixa de valer na hora.
    vi.stubEnv("OUTBOUND_TEAM_EMAILS", "outro@dreamy.app.br");
    expect(await getSession()).toBeNull();
  });

  it("sem cookie (ou sem segredo) requireSession redireciona para o login", async () => {
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/interno/login");
    cookieJar.set(SESSION_COOKIE, signSession("luigi@dreamy.app.br", SECRET));
    vi.stubEnv("OUTBOUND_SESSION_SECRET", "");
    expect(await getSession()).toBeNull();
  });

  it("createSessionCookie grava httpOnly/lax/path=/ por 30 dias; clearSessionCookie zera", async () => {
    await createSessionCookie("luigi@dreamy.app.br");
    const set = setCalls.at(-1)!;
    expect(set.name).toBe(SESSION_COOKIE);
    expect(verifySession(set.value, SECRET)).toEqual({ email: "luigi@dreamy.app.br" });
    expect(set.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: false, maxAge: 2_592_000 });
    expect(await getSession()).toEqual({ email: "luigi@dreamy.app.br" });

    await clearSessionCookie();
    expect(setCalls.at(-1)!.options).toMatchObject({ maxAge: 0, path: "/" });
    expect(await getSession()).toBeNull();
  });

  it("createSessionCookie lança sem segredo", async () => {
    vi.stubEnv("OUTBOUND_SESSION_SECRET", "");
    await expect(createSessionCookie("luigi@dreamy.app.br")).rejects.toThrow(/OUTBOUND_SESSION_SECRET/);
  });
});

describe("safeNextPath — destino pós-login", () => {
  it("aceita só caminhos internos do console", () => {
    expect(safeNextPath("/interno/outbound")).toBe("/interno/outbound");
    expect(safeNextPath("/interno/outbound/contatos?demo=1&q=x")).toBe("/interno/outbound/contatos?demo=1&q=x");
    expect(safeNextPath("/interno/outbound#frag")).toBe("/interno/outbound");
  });

  it("recusa URLs externas, protocol-relative, fora de /interno e o próprio login", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "/",
      "/contato",
      "/interno",
      "//evil.example/x",
      "https://evil.example/interno/outbound",
      "/interno/login",
      "/interno/login?next=/interno/outbound",
      "/interno/logout",
      `/interno/${"a".repeat(600)}`,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });
});

describe("link de acesso — sendLoginLink", () => {
  function stubResend() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "em_1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OUTBOUND_RESEND_API_KEY", "re_test");
    vi.stubEnv("OUTBOUND_FROM", "Dreamy <console@bedreamy.com.br>");
    return fetchMock;
  }

  it("envia para e-mail autorizado com link do callback (base = OUTBOUND_APP_URL) e reply_to da assinatura", async () => {
    const fetchMock = stubResend();
    vi.stubEnv("OUTBOUND_APP_URL", "https://mork.bedreamy.com.br/");
    await sendLoginLink("Luigi@Dreamy.app.br", "http://localhost:3000", { next: "/interno/outbound?demo=1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const [email] = JSON.parse(String(init.body)) as Array<Record<string, unknown>>;
    expect(email.to).toEqual(["luigi@dreamy.app.br"]);
    expect(email.subject).toBe("Seu acesso ao console da Dreamy");
    expect(email.reply_to).toBe("contact@bedreamy.com.br");
    const link = String(email.text).match(/https?:\/\/\S+/)![0];
    const parsed = new URL(link);
    expect(parsed.origin).toBe("https://mork.bedreamy.com.br");
    expect(parsed.pathname).toBe("/api/outbound/auth/callback");
    expect(parsed.searchParams.get("next")).toBe("/interno/outbound?demo=1");
    expect(verifyLoginToken(parsed.searchParams.get("token")!, SECRET)).toEqual({ email: "luigi@dreamy.app.br" });
  });

  it("e-mail fora da lista: mesmo retorno (void) e nenhuma chamada ao Resend", async () => {
    const fetchMock = stubResend();
    await expect(sendLoginLink("nao@dreamy.app.br", "http://localhost:3000")).resolves.toBeUndefined();
    await expect(sendLoginLink("", "http://localhost:3000")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem chave/remetente do Resend ou sem segredo: não envia nem lança", async () => {
    const fetchMock = stubResend();
    vi.stubEnv("OUTBOUND_RESEND_API_KEY", "");
    await expect(sendLoginLink("outro@dreamy.app.br", "http://localhost:3000")).resolves.toBeUndefined();
    vi.stubEnv("OUTBOUND_RESEND_API_KEY", "re_test");
    vi.stubEnv("OUTBOUND_SESSION_SECRET", "");
    await expect(sendLoginLink("outro@dreamy.app.br", "http://localhost:3000")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha do Resend vira log, não exceção", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    vi.stubEnv("OUTBOUND_RESEND_API_KEY", "re_test");
    vi.stubEnv("OUTBOUND_FROM", "Dreamy <console@bedreamy.com.br>");
    vi.stubEnv("OUTBOUND_TEAM_EMAILS", "falha@dreamy.app.br");
    await expect(sendLoginLink("falha@dreamy.app.br", "http://localhost:3000")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("rate limit: 5 links por e-mail a cada 15 min", async () => {
    const fetchMock = stubResend();
    vi.stubEnv("OUTBOUND_TEAM_EMAILS", "limite@dreamy.app.br");
    for (let i = 0; i < 7; i += 1) await sendLoginLink("limite@dreamy.app.br", "http://localhost:3000");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("appBaseUrl/buildLoginLinkUrl: env válida vence a origem; inválida cai na origem", () => {
    vi.stubEnv("OUTBOUND_APP_URL", "https://mork.bedreamy.com.br/app/");
    expect(appBaseUrl("http://localhost:3000")).toBe("https://mork.bedreamy.com.br/app");
    vi.stubEnv("OUTBOUND_APP_URL", "nao-e-url");
    expect(appBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(buildLoginLinkUrl("https://x.test", "t.k", null)).toBe(
      "https://x.test/api/outbound/auth/callback?token=t.k",
    );
  });
});

describe("proxy — guard de /interno e /api/outbound", () => {
  const BASE = "http://localhost:3100";

  function req(path: string, init: { cookie?: string; method?: string } = {}) {
    return new NextRequest(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: init.cookie ? { cookie: `${SESSION_COOKIE}=${init.cookie}` } : {},
    });
  }

  it("sem cookie: página redireciona ao login com next; API responde 401 JSON", async () => {
    const page = proxy(req("/interno/outbound/contatos?demo=1"));
    expect(page.status).toBe(307);
    const location = new URL(page.headers.get("location")!);
    expect(location.pathname).toBe("/interno/login");
    expect(location.searchParams.get("next")).toBe("/interno/outbound/contatos?demo=1");

    const api = proxy(req("/api/outbound/qualquer"));
    expect(api.status).toBe(401);
    expect(await api.json()).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("cookie válido de e-mail autorizado passa; revogado/adulterado não", () => {
    const ok = proxy(req("/interno/outbound", { cookie: signSession("luigi@dreamy.app.br", SECRET) }));
    expect(ok.headers.get("x-middleware-next")).toBe("1");

    const revoked = proxy(req("/interno/outbound", { cookie: signSession("ex@dreamy.app.br", SECRET) }));
    expect(revoked.status).toBe(307);
    expect(revoked.headers.get("set-cookie")).toMatch(new RegExp(`${SESSION_COOKIE}=;`));

    const forged = proxy(req("/interno/outbound", { cookie: signSession("luigi@dreamy.app.br", "outro") }));
    expect(forged.status).toBe(307);
  });

  it("POST sem sessão vira 303 (Server Action com sessão expirada segue com GET)", () => {
    const res = proxy(req("/interno/outbound", { method: "POST" }));
    expect(res.status).toBe(303);
  });

  it("fluxo de login é público; bypass de dev libera fora de produção e não em produção", () => {
    for (const path of [
      "/interno/login",
      "/interno/login?sent=1",
      "/interno/logout",
      "/api/outbound/auth/callback?token=x",
    ]) {
      expect(proxy(req(path)).headers.get("x-middleware-next"), path).toBe("1");
    }
    vi.stubEnv("OUTBOUND_AUTH_DISABLED", "true");
    expect(proxy(req("/interno/outbound")).headers.get("x-middleware-next")).toBe("1");
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(req("/interno/outbound")).status).toBe(307);
  });
});
