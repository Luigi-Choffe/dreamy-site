// One-off (2026-10-13): inscreve na campanha "controladoria-sistemas-sob-medida" EXATAMENTE
// a onda 1 da cesta (contatos ativos, industria controladoria, custom.cesta "controladoria onda-1"),
// com as mesmas guardas do enroll oficial (selectEnrollmentCandidates) e exigindo
// que as peças personalizadas (abertura, gancho) já existam no contato — sem elas o
// motor bloquearia o envio de qualquer forma. Campanha DRAFT: inscrever não envia.
// Uso: pnpm tsx scripts/dev/inscrever-controladoria.ts [--dry-run]

const SLUG = "controladoria-sistemas-sob-medida";

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const dryRun = process.argv.includes("--dry-run");
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
        (c.custom.cesta ?? "").startsWith("controladoria onda-1"),
    );
    const semPecas = onda1.filter((c) => !(c.custom.abertura ?? "").trim() || !(c.custom.gancho ?? "").trim());
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
