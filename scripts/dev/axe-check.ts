import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
(async () => {
  const base = process.argv[2] ?? "http://localhost:3000";
  const routes = (process.argv[3] ?? "/").split(",");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([
    {
      name: "dreamy_consent",
      value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, t: 1 })),
      url: base,
    },
  ]);
  const page = await ctx.newPage();
  let bad = 0;
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: "networkidle" });
    const res = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
      .disableRules(["region"])
      .analyze();
    const serious = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    console.log(
      r,
      serious.length ? "VIOLATIONS" : "ok",
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`).join("\n  "),
    );
    bad += serious.length;
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
