// One-off (2026-10-13): inscreve EXATAMENTE uma onda da cesta de CONTROLADORIA na
// campanha dela (contatos ativos, industria controladoria, custom.cesta "controladoria onda-N"),
// com as mesmas guardas do enroll oficial (selectEnrollmentCandidates).
//   onda 1 → controladoria-sistemas-sob-medida (exige abertura + gancho no contato)
//   onda 2 → controladoria-painel-planilha (variante genérica, sem slots)
// Campanhas DRAFT: inscrever não envia.
// Uso: pnpm tsx scripts/dev/inscrever-controladoria.ts --onda 1|2 [--dry-run]

const ONDAS: Record<string, { slug: string; exigePecas: boolean }> = {
  "1": { slug: "controladoria-sistemas-sob-medida", exigePecas: true },
  "2": { slug: "controladoria-painel-planilha", exigePecas: false },
};

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const dryRun = process.argv.includes("--dry-run");
  const iOnda = process.argv.indexOf("--onda");
  const onda = ONDAS[process.argv[iOnda + 1] ?? ""];
  if (iOnda < 0 || !onda) throw new Error("uso: --onda 1|2 [--dry-run]");
  const SLUG = onda.slug;
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  const { selectEnrollmentCandidates, buildEnrollment } = await import("../../src/lib/outbound/ops-core");

  await runExclusive("inscrever-controladoria", async () => {
    const store = openStore();
    const [contacts, enrollments, suppressions] = await Promise.all([
      store.contacts(),
      store.enrollments(),
      store.suppressions(),
    ]);
    const onda1 = contacts.filter(
      (c) =>
        c.industria === "controladoria" &&
        c.status === "active" &&
        (c.custom.cesta ?? "") === `controladoria onda-${process.argv[iOnda + 1]}`,
    );
    const semPecas = onda.exigePecas
      ? onda1.filter((c) => !(c.custom.abertura ?? "").trim() || !(c.custom.gancho ?? "").trim())
      : [];
    if (semPecas.length > 0) {
      console.log(`✖ ${semPecas.length} contato(s) da onda 1 ainda sem abertura/gancho — mescle as peças antes:`);
      for (const c of semPecas) console.log(`  ${c.nome} ${c.sobrenome ?? ""} · ${c.empresa}`);
      return;
    }
    const suppressed = new Set(suppressions.map((s) => s.email.trim().toLowerCase()));
    const eligible = [];
    for (const c of onda1) {
      const sel = selectEnrollmentCandidates({
        contacts: [c],
        enrollments,
        suppressed,
        campaignSlug: SLUG,
        industria: "controladoria",
      });
      if (sel.eligible.length === 1) eligible.push(c);
      else console.log(`  pulado: ${c.nome} · ${c.empresa} (${JSON.stringify(sel.skipped)})`);
    }
    console.log(`onda 1: ${onda1.length} · elegíveis: ${eligible.length}`);
    if (dryRun) {
      console.log("(dry-run: nada gravado)");
      return;
    }
    for (const c of eligible) enrollments.push(buildEnrollment(c, SLUG));
    await store.saveEnrollments(enrollments);
    console.log(`✓ ${eligible.length} enrollment(s) criado(s) em "${SLUG}" (draft: nada envia até o approve).`);
  });
}

void main();

export {};
