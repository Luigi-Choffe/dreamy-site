import { writeFileSync } from "node:fs";
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
import { campaigns } from "../../src/content/outbound";
import { buildEmail } from "../../src/lib/outbound/render";
import { openStore } from "../../src/lib/outbound/store";
const [, , slug = "construcao-nova-receita", out = "email-preview.html"] = process.argv;
const campaign = campaigns.find((c) => c.slug === slug)!;
async function main() {
  const store = openStore();
  const [contacts, enrollments] = await Promise.all([store.contacts(), store.enrollments()]);
  // Campanha ainda sem inscritos (draft): usa o primeiro contato ativo do segmento-alvo.
  const contact =
    contacts.find((c) => c.id === enrollments.find((e) => e.campaignSlug === slug)?.contactId) ??
    contacts.find((c) => c.status === "active" && c.industria === campaign.industria)!;
  const blocks = campaign.steps.map((step) => {
    const b = buildEmail(contact, campaign, step, { replyTo: "contact@bedreamy.com.br" });
    return `<div style="margin:24px auto;max-width:640px;border:1px solid #ddd;border-radius:8px;overflow:hidden;font-family:Arial,sans-serif">
<div style="background:#f5f5f5;padding:10px 16px;font-size:12px;color:#555">${step.id.toUpperCase()} · dia ${step.offsetDays === 0 ? "0" : "+" + step.offsetDays} — <b>De:</b> Luigi Choffe &lt;contact@bedreamy.com.br&gt; — <b>Assunto:</b> ${b.subject}</div>
<div style="background:#fff;padding:20px 24px;font-size:14px;line-height:1.6;color:#111">${b.html}</div></div>`;
  });
  writeFileSync(
    out,
    `<!doctype html><meta charset="utf-8"><title>Prévia — ${slug}</title><body style="background:#e9ecea;margin:0;padding:12px">${blocks.join("\n")}</body>`,
    "utf8",
  );
  console.log("gerado:", out, "| contato:", contact.nome, "·", contact.empresa);
}
main();
