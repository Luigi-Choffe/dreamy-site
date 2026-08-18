/**
 * QA visual (PRD §90): captura screenshots das rotas em 390 / 768 / 1440 px
 * a partir de um servidor local, e reporta erros de console/página.
 *
 * Uso: pnpm qa:screenshots [--base http://localhost:3000] [--out docs/qa/<pasta>] [--routes /,/solucoes]
 *      [--viewports 320,375,390,768,1024,1280,1440,1920] [--full] [--no-shots]
 * Requer: servidor rodando (pnpm dev ou pnpm start).
 */
import { chromium, type ConsoleMessage } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
const outDir = path.resolve(arg("out", "docs/qa/latest"));
const routes = arg(
  "routes",
  "/,/solucoes,/solucoes/nova-receita-digital,/solucoes/sistemas-sob-medida,/solucoes/agentes-de-ia,/sobre,/contato,/privacidade,/cookies,/pagina-inexistente",
)
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);
const fullPage = process.argv.includes("--full");
const noShots = process.argv.includes("--no-shots");

const DEFAULT_VIEWPORTS = "390,768,1440";
const viewports = arg("viewports", DEFAULT_VIEWPORTS)
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((w) => Number.isFinite(w) && w > 0)
  .map((width) => ({
    name: String(width),
    width,
    height: width < 768 ? 844 : width < 1280 ? 1024 : 900,
    isMobile: width < 1024,
    dsf: width < 1024 ? 2 : 1,
  }));

function slug(route: string) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9-]+/gi, "_");
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      deviceScaleFactor: vp.dsf,
      locale: "pt-BR",
      reducedMotion: "no-preference",
    });
    await context.addCookies([
      {
        name: "dreamy_consent",
        value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, t: 1 })),
        url: base,
      },
    ]);
    const page = await context.newPage();
    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        // o próprio documento 404 gera "Failed to load resource: 404" — esperado na página de erro
        if (/404 \(Not Found\)/.test(msg.text()) && /pagina-inexistente|404/.test(page.url())) return;
        problems.push(`[${vp.name}] ${page.url()} console.${msg.type()}: ${msg.text()}`);
      }
    };
    page.on("console", onConsole);
    page.on("pageerror", (err) => problems.push(`[${vp.name}] ${page.url()} pageerror: ${err.message}`));

    for (const route of routes) {
      const url = `${base}${route}`;
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      const status = res?.status();
      // rola lentamente para disparar reveals (IntersectionObserver) e volta ao topo
      await page.evaluate(async () => {
        const step = Math.round(window.innerHeight * 0.4);
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 140));
        }
        await new Promise((r) => setTimeout(r, 900));
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      if (overflow) problems.push(`[${vp.name}] ${route} HORIZONTAL OVERFLOW`);
      const h1s = await page.locator("h1").count();
      if (h1s !== 1) problems.push(`[${vp.name}] ${route} h1 count = ${h1s}`);
      const file = path.join(outDir, `${slug(route)}-${vp.name}${fullPage ? "-full" : ""}.png`);
      if (fullPage) {
        // evita artefatos de captura: header sticky repetido e skip link com foco
        await page.addStyleTag({ content: "header{position:static!important} .skip-link{display:none!important}" });
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      }
      if (!noShots) await page.screenshot({ path: file, fullPage });
      console.log(`ok ${vp.name.padEnd(4)} ${String(status).padEnd(3)} ${route}`);
    }
    await context.close();
  }
  await browser.close();

  if (problems.length) {
    console.log("\nProblemas encontrados:");
    for (const p of problems) console.log(" - " + p);
    process.exitCode = 1;
  } else {
    console.log("\nSem erros de console, overflow horizontal ou H1 duplicado.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
