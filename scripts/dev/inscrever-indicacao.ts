// One-off (2026-09-07): inscreve na campanha "validacao-indicacao" EXATAMENTE
// os contatos da onda 1 (custom.reativacao = "validacao-indicacao 2026-09-07 onda-1"),
// aplicando as mesmas guardas do enroll oficial (selectEnrollmentCandidates) —
// o CLI só filtra por indústria e arrastaria decisores nunca inscritos.
// A campanha está DRAFT: inscrever não envia nada até o approve do Luigi.
// Uso: pnpm tsx scripts/dev/inscrever-indicacao.ts [--dry-run]

const SLUG = "validacao-indicacao";
const MARCA = "validacao-indicacao 2026-09-07 onda-1";

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const dryRun = process.argv.includes("--dry-run");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  const { selectEnrollmentCandidates, buildEnrollment } = await import("../../src/lib/outbound/ops-core");

  await runExclusive("inscrever-indicacao", async () => {
    const store = openStore();
    const [contacts, enrollments, suppressions] = await Promise.all([
      store.contacts(),
      store.enrollments(),
      store.suppressions(),
    ]);
    const onda1 = contacts.filter((c) => c.custom.reativacao === MARCA);
    if (onda1.length !== 6) throw new Error(`esperava 6 contatos onda-1, achei ${onda1.length} — abortando`);

    // Mesmas guardas do enroll oficial, indústria a indústria (a copy é única,
    // mas a seleção respeita a indústria de cada contato).
    const eligible = [];
    for (const c of onda1) {
      const sel = selectEnrollmentCandidates({
        contacts: [c],
        enrollments,
        suppressed: new Set(suppressions.map((s) => s.email.trim().toLowerCase())),
        campaignSlug: SLUG,
        industria: c.industria ?? "",
      });
      if (sel.eligible.length === 1) eligible.push(c);
      else console.log(`  pulado: ${c.nome} · ${c.empresa} (${JSON.stringify(sel.skipped)})`);
    }

    if (dryRun) {
      console.log(`DRY-RUN — inscreveria ${eligible.length}:`);
      for (const c of eligible) console.log(`  ${c.nome} ${c.sobrenome ?? ""} · ${c.empresa} · ${c.industria}`);
      return;
    }
    for (const c of eligible) enrollments.push(buildEnrollment(c, SLUG));
    await store.saveEnrollments(enrollments);
    console.log(
      `✓ ${eligible.length} enrollment(s) criado(s) em "${SLUG}" (campanha draft — nada envia até o approve).`,
    );
  });
}

void main();

export {};
