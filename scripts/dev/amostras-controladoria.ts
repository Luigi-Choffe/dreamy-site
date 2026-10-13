// One-off (2026-10-13): renderiza E1 REAIS da onda 1 de CONTROLADORIA antes da
// inscrição (render-amostras.ts exige inscritos). Usa o mesmo buildEmail do motor e
// a frase dos colegas calculada a partir da própria cesta (quem mais da empresa está
// na onda 1), como o envio fará. Sem e-mail no stdout. Só leitura.
// Uso: pnpm tsx scripts/dev/amostras-controladoria.ts [quantos=3] [semente=1]

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function main(): Promise<void> {
  const quantos = Number(process.argv[2] ?? 3);
  const semente = Number(process.argv[3] ?? 1);
  const { openStore } = await import("../../src/lib/outbound/store");
  const { campaigns } = await import("../../src/content/outbound");
  const { buildEmail, lintEmail, lintErrors } = await import("../../src/lib/outbound/render");
  const { fraseColegas } = await import("../../src/lib/outbound/colegas");
  const campaign = campaigns.find((c) => c.slug === "controladoria-sistemas-sob-medida");
  if (!campaign) throw new Error("campanha não registrada");
  const contacts = await openStore().contacts();
  const onda1 = contacts.filter(
    (c) => c.industria === "controladoria" && c.status === "active" && c.custom.cesta === "controladoria onda-1",
  );
  const comColegas = onda1.filter((c) => onda1.some((o) => o.id !== c.id && o.empresa === c.empresa));
  const solos = onda1.filter((c) => !comColegas.includes(c));
  const escolhidos = [comColegas[semente % comColegas.length], ...solos.filter((_, i) => i % 97 === semente % 97)]
    .filter(Boolean)
    .slice(0, quantos);
  let erros = 0;
  for (const c of escolhidos) {
    if (!c) continue;
    const colegas = onda1
      .filter((o) => o.id !== c.id && o.empresa === c.empresa)
      .map((o) => o.nome.split(/\s+/)[0] ?? "");
    const sonda = { ...c, custom: { ...c.custom, frase_colegas: fraseColegas(colegas, c.empresa) } };
    const b = buildEmail(sonda, campaign, campaign.steps[0]!, { replyTo: "contact@bedreamy.com.br" });
    const errs = lintErrors(lintEmail(b.subject, b.text, { subjectTemplate: campaign.steps[0]!.subject }));
    erros += errs.length;
    const palavras = b.text.split(/\s+/).filter(Boolean).length;
    console.log(
      `\n══ ${c.cargo} · ${c.empresa} · ${palavras} palavras · lint ${errs.length === 0 ? "ok" : errs.map((e) => e.rule).join(",")}`,
    );
    console.log(`Assunto: ${b.subject}\n`);
    console.log(b.text);
  }
  console.log(`\nonda 1: ${onda1.length} · com colegas: ${comColegas.length} · erros de lint nas amostras: ${erros}`);
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
