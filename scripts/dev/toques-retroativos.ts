// One-off (2026-09-14): toque no LinkedIn para quem JÁ recebeu e-mail e nunca viu
// o Luigi por lá. O toque prévio automático só nasceu em 10/09 e cobre quem ainda
// vai receber E1; os prospects que estavam no meio da sequência (construção, obras,
// engenharia, validação) ficaram de fora. Cria UMA tarefa "toque-previo" por contato
// (mesma fila do Hoje, mesma idempotência: tarefa existente ou toque registrado
// bloqueia repetição), só para quem já teve envio entregue e tem perfil válido.
// Uso: pnpm tsx scripts/dev/toques-retroativos.ts [--apply]

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const apply = process.argv.includes("--apply");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  const { getOutboundEnv, sendDateKey } = await import("../../src/lib/outbound/config");
  const { linkedinUrl, planejarToquesPrevios, TOQUE_PREVIO_CUSTOM } =
    await import("../../src/lib/outbound/toque-previo");

  await runExclusive("toques-retroativos", async () => {
    const store = openStore();
    const [contacts, enrollments, sends, tasks] = await Promise.all([
      store.contacts(),
      store.enrollments(),
      store.sends(),
      store.tasks(),
    ]);
    const hojeKey = sendDateKey(new Date(), getOutboundEnv().utcOffset);
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const recebeu = new Set(
      sends.filter((s) => s.status === "delivered" || s.status === "sent").map((s) => s.contactId),
    );

    const candidatos = [];
    const vistos = new Set<string>();
    for (const e of enrollments) {
      if (e.status !== "active" || vistos.has(e.contactId) || !recebeu.has(e.contactId)) continue;
      const contact = byId.get(e.contactId);
      if (!contact || contact.status !== "active") continue;
      if ((contact.custom[TOQUE_PREVIO_CUSTOM] ?? "").trim() !== "") continue;
      if (!linkedinUrl(contact)) continue;
      vistos.add(contact.id);
      candidatos.push({ contact, campaignSlug: e.campaignSlug, e1Em: hojeKey });
    }
    const novas = planejarToquesPrevios({ candidatos, tasks, hojeKey });

    const porCampanha: Record<string, number> = {};
    for (const c of candidatos) {
      if (novas.some((t) => t.contactId === c.contact.id))
        porCampanha[c.campaignSlug] = (porCampanha[c.campaignSlug] ?? 0) + 1;
    }
    console.log(`candidatos: ${candidatos.length} · tarefas novas: ${novas.length}`, porCampanha);
    if (!apply) {
      console.log("(dry-run: nada gravado; use --apply)");
      return;
    }
    tasks.push(...novas);
    await store.saveTasks(tasks);
    console.log(`✓ ${novas.length} toque(s) retroativo(s) na fila do Hoje.`);
  });
}

void main();

export {};
