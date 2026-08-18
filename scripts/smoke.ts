/**
 * Smoke test de deploy (Fases 8–9 do PRD): verifica em segundos, sem browser, se um ambiente
 * publicado está coerente — rotas 200, 404 própria, headers de segurança, regime de indexação
 * (preview = noindex; produção = indexável + HSTS), API de leads respondendo, OG image e,
 * opcionalmente, o mapa de redirects da migração (docs/redirect-map.csv).
 *
 * Uso:
 *   pnpm smoke --base https://dreamy-site.vercel.app            # infere o regime pelo robots.txt
 *   pnpm smoke --base https://www.dreamy.app.br --expect production --redirects
 *   pnpm smoke --base http://localhost:3100 --expect preview
 *
 * Não substitui `pnpm test:e2e` (que pode rodar contra qualquer URL via PLAYWRIGHT_BASE_URL);
 * é a checagem rápida da checklist de lançamento (docs/LAUNCH-CHECKLIST.md).
 */
import fs from "node:fs";
import path from "node:path";

type Expect = "preview" | "production";

interface Result {
  ok: boolean;
  label: string;
  detail?: string;
}

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}

const baseArg = flag("base") ?? process.env.SMOKE_BASE_URL;
if (!baseArg) {
  console.error("Uso: pnpm smoke --base <url> [--expect preview|production] [--redirects]");
  process.exit(2);
}
const base = baseArg.replace(/\/+$/, "");
const expectArg = flag("expect") as Expect | undefined;
const checkRedirects = flag("redirects") === "true";
const timeoutMs = Number(flag("timeout") ?? 15_000);

const results: Result[] = [];
function record(ok: boolean, label: string, detail?: string) {
  results.push({ ok, label, detail });
  const mark = ok ? "✓" : "✖";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function get(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const started = Date.now();
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "dreamy-smoke/1.0", accept: "text/html,*/*" },
      ...init,
      signal: controller.signal,
    });
    const text = await res.text();
    return { res, text, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

const PUBLIC_ROUTES = [
  "/",
  "/solucoes",
  "/solucoes/nova-receita-digital",
  "/solucoes/sistemas-sob-medida",
  "/solucoes/agentes-de-ia",
  "/sobre",
  "/contato",
  "/privacidade",
  "/cookies",
];
const GATED_ROUTES = ["/cases", "/insights"];

async function main() {
  console.log(`Smoke test → ${base}\n`);

  /* ------------------------------ regime ------------------------------ */
  const robots = await get(`${base}/robots.txt`);
  const robotsAllows = /^Allow:\s*\/\s*$/m.test(robots.text) && !/^Disallow:\s*\/\s*$/m.test(robots.text);
  const expect: Expect = expectArg ?? (robotsAllows ? "production" : "preview");
  console.log(`Regime esperado: ${expect}${expectArg ? "" : " (inferido pelo robots.txt)"}\n`);

  /* ------------------------------- rotas ------------------------------ */
  for (const route of PUBLIC_ROUTES) {
    try {
      const { res, text, ms } = await get(`${base}${route}`);
      const hasH1 = /<h1[\s>]/i.test(text);
      record(res.status === 200 && hasH1, `GET ${route}`, `${res.status}${hasH1 ? "" : " sem <h1>"} · ${ms} ms`);
    } catch (e) {
      record(false, `GET ${route}`, String(e));
    }
  }
  for (const route of GATED_ROUTES) {
    const { res } = await get(`${base}${route}`);
    record([200, 404].includes(res.status), `GET ${route} (gate de conteúdo)`, `${res.status}`);
  }
  {
    const { res, text } = await get(`${base}/rota-inexistente-smoke`);
    record(
      res.status === 404 && /não existe|n&atilde;o existe/i.test(text),
      "404 própria (status + copy)",
      `${res.status}`,
    );
  }

  /* ------------------------------ headers ----------------------------- */
  const home = await get(`${base}/`);
  const h = home.res.headers;
  record(h.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
  record(!!h.get("referrer-policy"), "Referrer-Policy presente", h.get("referrer-policy") ?? "ausente");
  record(!!h.get("x-frame-options"), "X-Frame-Options presente", h.get("x-frame-options") ?? "ausente");
  record(!!h.get("permissions-policy"), "Permissions-Policy presente");
  const csp = h.get("content-security-policy");
  const cspRo = h.get("content-security-policy-report-only");
  record(!!(csp || cspRo), "CSP presente", csp ? "enforce" : cspRo ? "report-only" : "ausente");
  record(!h.get("x-powered-by"), "Sem X-Powered-By");
  const html = home.text;
  record(/<html[^>]*lang="pt-BR"/i.test(html), '<html lang="pt-BR">');
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? "";
  record(/^https:\/\//.test(canonical), "canonical da home", canonical || "ausente");
  record(/<script[^>]+type="application\/ld\+json"/i.test(html), "JSON-LD presente");

  /* --------------------------- regime de indexação -------------------- */
  const sitemap = await get(`${base}/sitemap.xml`);
  const metaRobotsNoindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html);
  const xRobots = h.get("x-robots-tag") ?? "";
  if (expect === "preview") {
    record(/^Disallow:\s*\/\s*$/m.test(robots.text), "robots.txt: Disallow: /");
    record(!/<loc>/.test(sitemap.text), "sitemap.xml vazio");
    record(/noindex/i.test(xRobots), "X-Robots-Tag: noindex", xRobots || "ausente");
    record(metaRobotsNoindex, "<meta name=robots> noindex");
  } else {
    record(robotsAllows, "robots.txt: Allow: / (sem Disallow: /)");
    record(/Sitemap:\s*https:\/\/www\.dreamy\.app\.br\/sitemap\.xml/i.test(robots.text), "robots.txt aponta o sitemap");
    record(/<loc>https:\/\/www\.dreamy\.app\.br\/<\/loc>/.test(sitemap.text), "sitemap.xml lista a home");
    record(!/noindex/i.test(xRobots), "Sem X-Robots-Tag noindex", xRobots || "ok");
    record(!metaRobotsNoindex, "Sem <meta robots> noindex");
    record(/max-age=\d+/.test(h.get("strict-transport-security") ?? ""), "HSTS presente");
    record(/^https:\/\/www\.dreamy\.app\.br\/?$/.test(canonical), "canonical aponta o domínio oficial", canonical);
    if (/^https:\/\/www\.dreamy\.app\.br$/.test(base)) {
      for (const origin of ["https://dreamy.app.br", "http://dreamy.app.br", "http://www.dreamy.app.br"]) {
        try {
          const { res } = await get(`${origin}/`);
          const loc = res.headers.get("location") ?? "";
          record(
            [301, 308].includes(res.status) && /^https:\/\/www\.dreamy\.app\.br\/?$/.test(loc),
            `${origin}/ → https://www.dreamy.app.br/`,
            `${res.status} ${loc}`,
          );
        } catch (e) {
          record(false, `${origin}/ → https://www.dreamy.app.br/`, String(e));
        }
      }
    }
  }

  /* --------------------------------- API ------------------------------ */
  {
    const { res } = await get(`${base}/api/leads`);
    record(res.status === 405, "GET /api/leads → 405", `${res.status}`);
    const post = await get(`${base}/api/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "dreamy-smoke/1.0" },
      body: "{",
    });
    record(post.res.status === 400, "POST /api/leads (JSON inválido) → 400", `${post.res.status}`);
  }

  /* ------------------------------ OG image ---------------------------- */
  {
    const { res } = await get(`${base}/opengraph-image`);
    const type = res.headers.get("content-type") ?? "";
    record(res.status === 200 && /^image\//.test(type), "OG image da home", `${res.status} ${type}`);
  }

  /* --------------------------- redirect map --------------------------- */
  if (checkRedirects) {
    const csvPath = path.join(process.cwd(), "docs", "redirect-map.csv");
    const rows = fs
      .readFileSync(csvPath, "utf8")
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((l) => l.split(",").map((c) => c.trim()))
      .filter((c) => c.length >= 3);
    for (const [oldUrl, newUrl, status] of rows) {
      if (status === "client-side" || !/^https?:\/\//.test(oldUrl!)) continue;
      try {
        // segue a cadeia (ex.: http→https no edge e depois apex→www); todos os saltos devem ser 301/308
        const hops: string[] = [];
        let current = oldUrl!;
        let finalStatus = 0;
        for (let i = 0; i < 5; i++) {
          const { res } = await get(current);
          finalStatus = res.status;
          const loc = res.headers.get("location");
          if (![301, 302, 307, 308].includes(res.status) || !loc) break;
          hops.push(`${res.status} → ${loc}`);
          if (![301, 308].includes(res.status)) break; // redirect temporário não vale para migração
          current = new URL(loc, current).toString();
        }
        const norm = (u: string) => u.replace(/\/$/, "");
        const ok =
          status === "200"
            ? finalStatus === 200 && norm(current) === norm(newUrl!)
            : hops.length > 0 &&
              hops.every((h) => /^30[18] /.test(h)) &&
              finalStatus === 200 &&
              norm(current) === norm(newUrl!);
        record(
          ok,
          `redirect-map: ${oldUrl} → ${newUrl}`,
          hops.length ? `${hops.join(" · ")}${hops.length > 1 ? ` (${hops.length} saltos)` : ""}` : `${finalStatus}`,
        );
      } catch (e) {
        record(false, `redirect-map: ${oldUrl}`, String(e));
      }
    }
  }

  /* -------------------------------- saída ----------------------------- */
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações OK`);
  if (failed.length) {
    console.error(`✖ ${failed.length} falha(s):`);
    for (const f of failed) console.error(` - ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
