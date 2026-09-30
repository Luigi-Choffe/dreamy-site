// One-off (2026-09-25): leitura consolidada para a análise geral ao Luigi.
// Pessoas alcançadas (≥1 e-mail entregue) por campanha, quantos passos cada uma
// recebeu, resposta, e o corte com/sem toque prévio no LinkedIn. Não grava nada.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function main(): Promise<void> {
  const { openStore } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const [contacts, sends, replies, enrollments] = await Promise.all([
    store.contacts(),
    store.sends(),
    store.replies(),
    store.enrollments(),
  ]);
  const respondeu = new Set(replies.map((r) => r.contactId));
  const porCampanha = new Map<string, { pessoas: Set<string>; entregues: number }>();
  for (const s of sends.filter((x) => x.status === "delivered")) {
    const c = porCampanha.get(s.campaignSlug) ?? { pessoas: new Set<string>(), entregues: 0 };
    c.pessoas.add(s.contactId);
    c.entregues += 1;
    porCampanha.set(s.campaignSlug, c);
  }
  console.log("campanha · pessoas alcançadas · e-mails entregues · responderam · sequências ativas");
  for (const [slug, c] of porCampanha) {
    const r = [...c.pessoas].filter((id) => respondeu.has(id)).length;
    const ativos = enrollments.filter((e) => e.campaignSlug === slug && e.status === "active").length;
    console.log(`  ${slug} · ${c.pessoas.size} · ${c.entregues} · ${r} · ${ativos}`);
  }
  const alcancados = new Set([...porCampanha.values()].flatMap((c) => [...c.pessoas]));
  const byId = new Map(contacts.map((c) => [c.id, c]));
  let com = 0,
    comR = 0,
    sem = 0,
    semR = 0;
  for (const id of alcancados) {
    const toque = String(byId.get(id)?.custom?.toque_previo ?? "");
    if (toque.startsWith("enviado")) {
      com += 1;
      if (respondeu.has(id)) comR += 1;
    } else {
      sem += 1;
      if (respondeu.has(id)) semR += 1;
    }
  }
  console.log(`toque prévio LinkedIn: com ${com} (${comR} resposta) · sem ${sem} (${semR} resposta)`);
  console.log(`total alcançado: ${alcancados.size} pessoas · respostas: ${respondeu.size}`);
}
main();

export {};
