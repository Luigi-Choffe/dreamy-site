/** Envia o E1 real para a caixa do próprio usuário (teste pré-disparo, fora do store). */
import { campaigns } from "../../src/content/outbound";
import { buildEmail } from "../../src/lib/outbound/render";
import { createResendClient } from "../../src/lib/outbound/resend";
import { SIGNATURE } from "../../src/lib/outbound/signature";
import type { Contact } from "../../src/lib/outbound/types";
try {
  process.loadEnvFile(".env.local");
} catch {
  /* env do shell */
}
const campaign = campaigns.find((c) => c.slug === "construcao-nova-receita")!;
const contact: Contact = {
  id: "teste",
  email: SIGNATURE.email,
  nome: "Luigi",
  empresa: "Incorporadora Exemplo",
  industria: campaign.industria,
  custom: { ...campaign.sampleCustom },
  importBatchId: "teste",
  verification: "ok",
  status: "active",
  createdAt: new Date().toISOString(),
};
async function main() {
  const key = process.env.OUTBOUND_RESEND_API_KEY!;
  const from = process.env.OUTBOUND_FROM!;
  const client = createResendClient(key);
  const b = buildEmail(contact, campaign, campaign.steps[0]!, { replyTo: SIGNATURE.email });
  const ids = await client.sendBatch(
    [
      {
        from,
        to: [SIGNATURE.email],
        subject: `[teste] ${b.subject}`,
        text: b.text,
        html: b.html,
        reply_to: SIGNATURE.email,
        headers: b.headers,
      },
    ],
    `teste-assinatura-${new Date().toISOString().slice(0, 16)}`,
  );
  console.log("enviado, id:", ids[0]);
  await new Promise((r) => setTimeout(r, 6000));
  const status = await client.getEmail(ids[0]!);
  console.log("status após 6s:", status.last_event);
}
main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
