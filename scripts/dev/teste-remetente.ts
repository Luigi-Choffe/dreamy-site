// Teste do remetente pessoal + assinatura + copy v3 (2026-09-14): envia o E3 NOVO de
// obras, renderizado pelo motor com a assinatura oficial, com o From e o Reply-To do
// .env.local, SÓ para a caixa do Luigi. Acompanha o status até a entrega.
// Uso: pnpm tsx scripts/dev/teste-remetente.ts

const DESTINO = "luigi.choffe@bedreamy.com.br";

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { campaigns } = await import("../../src/content/outbound");
  const { buildEmail } = await import("../../src/lib/outbound/render");
  const { getOutboundEnv, replyToField } = await import("../../src/lib/outbound/config");
  const env = getOutboundEnv();
  const apiKey = process.env.OUTBOUND_RESEND_API_KEY;
  const from = process.env.OUTBOUND_FROM;
  if (!apiKey || !from || !env.replyTo)
    throw new Error("faltam OUTBOUND_RESEND_API_KEY / OUTBOUND_FROM / OUTBOUND_REPLY_TO");

  const campaign = campaigns.find((c) => c.slug === "obras-sistemas-sob-medida");
  const step = campaign?.steps.find((s) => s.id === "e3");
  if (!campaign || !step) throw new Error("campanha ou passo não encontrado");
  const contato = {
    id: "teste",
    email: DESTINO,
    nome: "Luigi",
    cargo: "Sócio",
    empresa: "Dreamy",
    industria: campaign.industria,
    custom: { abertura: String(campaign.sampleCustom?.abertura ?? "") },
    importBatchId: "teste",
    verification: "ok",
    status: "active",
    createdAt: new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const built = buildEmail(contato, campaign, step, { replyTo: env.replyTo });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [DESTINO],
      reply_to: replyToField(env),
      subject: `[teste] ${built.subject}`,
      text: built.text,
      html: built.html,
    }),
  });
  if (!res.ok) throw new Error(`envio falhou: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  console.log(`From: ${from}`);
  console.log(`Reply-To: ${JSON.stringify(replyToField(env))}`);
  console.log(`Assunto: [teste] ${built.subject}`);
  console.log("Assinatura (texto):");
  for (const linha of built.text.trim().split("\n").slice(-4)) console.log(`  ${linha}`);

  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const check = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!check.ok) continue;
    const body = (await check.json()) as { last_event?: string };
    if (body.last_event === "delivered" || body.last_event === "bounced" || body.last_event === "failed") {
      console.log(`status: ${body.last_event}`);
      return;
    }
  }
  console.log("sem estado final em 60s — conferir no painel do Resend");
}

void main();

export {};
