import { chromium, devices } from "@playwright/test";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3100";
(async () => {
  const b = await chromium.launch();
  // mobile: banner + menu
  const m = await b.newContext({ ...devices["Pixel 7"] });
  const p = await m.newPage();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/m-banner.png` });
  await p
    .getByRole("button", { name: /Aceitar|Aceito|todos/i })
    .first()
    .click()
    .catch(() => {});
  await p.waitForTimeout(400);
  await p
    .getByRole("button", { name: /menu|Abrir/i })
    .first()
    .click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/m-menu.png` });
  await m.close();
  // desktop: banner + dropdown + preferences dialog
  const d = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const q = await d.newPage();
  await q.goto(base + "/", { waitUntil: "networkidle" });
  await q.waitForTimeout(800);
  await q.screenshot({ path: `${out}/d-banner.png` });
  const prefs = q.getByRole("button", { name: /Personalizar|Preferências|Gerenciar/i }).first();
  if (await prefs.count()) {
    await prefs.click();
    await q.waitForTimeout(500);
    await q.screenshot({ path: `${out}/d-prefs.png` });
    await q.keyboard.press("Escape");
  }
  await q
    .getByRole("button", { name: /Aceitar|Aceito|todos/i })
    .first()
    .click()
    .catch(() => {});
  await q
    .getByRole("button", { name: /Soluções/ })
    .first()
    .click();
  await q.waitForTimeout(400);
  await q.screenshot({ path: `${out}/d-dropdown.png`, clip: { x: 300, y: 0, width: 900, height: 420 } });
  await d.close();
  await b.close();
})();
