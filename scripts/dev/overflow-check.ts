import { chromium } from "@playwright/test";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await p.goto(process.argv[2] ?? "http://localhost:3000/", { waitUntil: "networkidle" });
  const out = await p.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const res: string[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > docW + 1 || r.left < -1) {
        const e = el as HTMLElement;
        res.push(
          `${e.tagName.toLowerCase()}.${e.className && typeof e.className === "string" ? e.className.split(" ").slice(0, 4).join(".") : ""} left=${Math.round(r.left)} right=${Math.round(r.right)} w=${Math.round(r.width)}`,
        );
      }
    });
    return { docW, scrollW: document.documentElement.scrollWidth, res: res.slice(0, 25) };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
