// Diagnóstico de POSICIONAMENTO (inbox vs spam): envia um E1 real da campanha
// (mesma copy, assinatura, from e reply-to do motor) para caixas NOSSAS de
// teste, para conferir onde o filtro do provedor coloca o e-mail. Não toca no
// store nem no motor; destinos restritos às caixas do próprio time.
// Uso: pnpm tsx scripts/dev/teste-posicionamento.ts <destino> [destino2...]

const PERMITIDOS = new Set([
  "luigi.choffe@bedreamy.com.br",
  "contact@bedreamy.com.br",
  "luigi.lgv@hotmail.com",
  // Caixa corporativa do próprio Luigi (pedido dele em 10/09) — testa o filtro M365.
  "luigi.choffe@antaresvision.com",
]);

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const destinos = process.argv.slice(2);
  if (destinos.length === 0) throw new Error("informe ao menos um destino");
  for (const d of destinos) if (!PERMITIDOS.has(d)) throw new Error(`destino não permitido: ${d}`);

  const apiKey = process.env.OUTBOUND_RESEND_API_KEY;
  const from = process.env.OUTBOUND_FROM;
  const replyTo = process.env.OUTBOUND_REPLY_TO;
  if (!apiKey || !from || !replyTo) throw new Error("faltam envs OUTBOUND_*");

  const { campaigns } = await import("../../src/content/outbound");
  const { buildEmail } = await import("../../src/lib/outbound/render");
  const campaign = campaigns.find((c) => c.slug === "construcao-nova-receita");
  if (!campaign) throw new Error("campanha não encontrada");
  const step = campaign.steps[0];
  const contatoSintetico = {
    id: "teste",
    email: "teste@bedreamy.com.br",
    nome: "Luigi",
    cargo: "Sócio",
    empresa: "Dreamy",
    industria: campaign.industria,
    custom: { abertura: (campaign.sampleCustom?.abertura ?? "").toString() },
    importBatchId: "teste",
    verification: "ok",
    status: "active",
    createdAt: new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const built = buildEmail(contatoSintetico, campaign, step, { replyTo });

  for (const to of destinos) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: replyTo,
        subject: built.subject,
        text: built.text,
        html: built.html,
      }),
    });
    if (!res.ok) throw new Error(`envio para ${to} falhou: ${res.status} ${await res.text()}`);
    const { id } = (await res.json()) as { id: string };
    console.log(`enviado para ${to} (id ${id}) — assunto: "${built.subject}"`);
  }
  console.log("Agora confira em cada caixa: caiu na ENTRADA ou no LIXO ELETRÔNICO?");
}

void main();

export {};
