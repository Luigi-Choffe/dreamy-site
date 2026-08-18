import { chromium } from "@playwright/test";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const msgs: string[] = [];
  p.on("console", (m) => msgs.push(`${m.type()}: ${m.text()}`));
  await p.goto(process.argv[2] ?? "http://localhost:3100/contato", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  console.log(msgs.filter((m) => /Content Security|CSP|Refused/i.test(m)).join("\n") || "no CSP messages");
  await b.close();
})();
