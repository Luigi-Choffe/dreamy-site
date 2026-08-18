import { chromium } from "@playwright/test";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (m) => {
    if (m.type() === "error") console.log("console.error:", m.text());
  });
  p.on("pageerror", (e) => console.log("pageerror:", e.message));
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const before = await p.evaluate(
    () => getComputedStyle(document.querySelector("#solucoes-title")!.parentElement!.parentElement!).opacity,
  );
  await p.evaluate(() => document.querySelector("#solucoes")!.scrollIntoView());
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => {
    const el = document.querySelector("#solucoes-title")!.parentElement!.parentElement!;
    return { opacity: getComputedStyle(el).opacity, cls: el.className, style: el.getAttribute("style") };
  });
  console.log({ before, after });
  await b.close();
})();
