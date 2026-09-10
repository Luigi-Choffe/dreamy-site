// Renderiza e-mails REAIS de amostra de uma campanha (subject + texto, com a
// assinatura) para revisão humana antes do approve. Escolhe contatos inscritos
// e ativos; e-mail do contato NUNCA é impresso (só nome, cargo e empresa).
// Uso: pnpm tsx scripts/dev/render-amostras.ts <slug> [passo=e1] [quantos=3]

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const [slug, passoArg, quantosArg] = process.argv.slice(2);
  if (!slug) throw new Error("uso: render-amostras.ts <slug> [passo] [quantos]");
  const passo = passoArg ?? "e1";
  const quantos = Number(quantosArg ?? 3);
  const { campaigns } = await import("../../src/content/outbound");
  const { buildEmail } = await import("../../src/lib/outbound/render");
  const { openStore } = await import("../../src/lib/outbound/store");
  const campaign = campaigns.find((c) => c.slug === slug);
  if (!campaign) throw new Error(`campanha "${slug}" não registrada`);
  const step = campaign.steps.find((s) => s.id === passo);
  if (!step) throw new Error(`passo "${passo}" não existe`);

  const store = openStore();
  const [contacts, enrollments] = await Promise.all([store.contacts(), store.enrollments()]);
  const inscritos = new Set(
    enrollments.filter((e) => e.campaignSlug === slug && e.status === "active").map((e) => e.contactId),
  );
  const alvo = contacts.filter((c) => inscritos.has(c.id) && c.status === "active");
  // Diversidade: um decisor, um operacional, um "solo" (frase_colegas solo) quando existirem.
  const decisor = alvo.find((c) => /diretor|ceo|s[oó]ci|head|founder|presidente|gerente geral/i.test(c.cargo ?? ""));
  const solo = alvo.find((c) => (c.custom.frase_colegas ?? "").startsWith("Escrevo para você primeiro"));
  const operacional = alvo.find(
    (c) => c !== decisor && c !== solo && /coord|supervis|gerente|l[ií]der/i.test(c.cargo ?? ""),
  );
  const escolhidos = [decisor, operacional, solo].filter((c): c is NonNullable<typeof c> => Boolean(c));
  for (const c of alvo) {
    if (escolhidos.length >= quantos) break;
    if (!escolhidos.includes(c)) escolhidos.push(c);
  }

  for (const c of escolhidos.slice(0, quantos)) {
    const b = buildEmail(c, campaign, step, {
      replyTo: process.env.OUTBOUND_REPLY_TO?.split(",")[0]?.trim() ?? "contact@bedreamy.com.br",
    });
    console.log(`\n══════ ${c.nome} ${c.sobrenome ?? ""} · ${c.cargo ?? "(sem cargo)"} · ${c.empresa} ══════`);
    console.log(`Assunto: ${b.subject}\n`);
    console.log(b.text);
  }
}

void main();

export {};
