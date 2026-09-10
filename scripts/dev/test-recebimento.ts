// Teste de recebimento pós-migração de e-mail: envia um e-mail simples via
// Resend para uma caixa NOSSA do domínio e acompanha o status até
// delivered/bounced. Não toca no motor nem no store.
// Uso: pnpm tsx scripts/dev/test-recebimento.ts [destino@bedreamy.com.br]
// (sem argumento, usa OUTBOUND_REPLY_TO; só aceita destino do próprio domínio)

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const apiKey = process.env.OUTBOUND_RESEND_API_KEY;
  const from = process.env.OUTBOUND_FROM;
  const to = process.argv[2] ?? process.env.OUTBOUND_REPLY_TO;
  if (to && !to.endsWith("@bedreamy.com.br")) throw new Error("teste só para caixas do próprio domínio");
  if (!apiKey || !from || !to) throw new Error("faltam OUTBOUND_RESEND_API_KEY / OUTBOUND_FROM / OUTBOUND_REPLY_TO");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "[teste] recebimento pos-migracao Google",
      text: "Teste do MORK: confirmando que a caixa recebe apos a troca do MX para o Google. Pode ignorar.",
    }),
  });
  if (!res.ok) throw new Error(`envio falhou: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  console.log(`enviado, id ${id} — aguardando status...`);

  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const check = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!check.ok) continue;
    const body = (await check.json()) as { last_event?: string };
    console.log(`  ${new Date().toISOString()} last_event=${body.last_event}`);
    if (body.last_event === "delivered" || body.last_event === "bounced" || body.last_event === "failed") return;
  }
  console.log("sem estado final em 60s — conferir no painel do Resend");
}

void main();

export {};
