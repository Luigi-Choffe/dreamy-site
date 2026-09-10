// Correção (2026-09-10): contatos da cesta de logística cujo e-mail é de OUTRA
// empresa (headline aponta emprego novo: provável mudança) saem da onda 1 para a
// reserva — o E1 diria "aí na Smolka" para alguém da Quality Transportes.
// Para os inscritos: enrollment vira "stopped" e o contato vai a excluded com
// motivo "dominio-divergente-logistica". Rode apply-colegas depois (os colegas
// deles precisam de frase recalculada).
// Uso: pnpm tsx scripts/dev/segurar-dominio-divergente.ts [--apply]

const SLUG = "logistica-estoque-receita";

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const apply = process.argv.includes("--apply");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  await runExclusive("segurar-dominio-divergente", async () => {
    const store = openStore();
    const [contacts, enrollments] = await Promise.all([store.contacts(), store.enrollments()]);
    const alvo = contacts.filter(
      (c) => c.industria === "logística" && c.status === "active" && (c.custom.cesta ?? "").includes("⚠"),
    );
    for (const c of alvo) {
      console.log(`  ${c.nome} ${c.sobrenome ?? ""} · ${c.empresa} · domínio ${c.email.split("@")[1]}`);
      if (!apply) continue;
      c.status = "excluded";
      c.excludedReason = "dominio-divergente-logistica";
      c.custom.cesta = "logistica reserva (dominio divergente; conferir emprego atual)";
      for (const e of enrollments) {
        if (e.contactId === c.id && e.campaignSlug === SLUG && e.status === "active") {
          e.status = "stopped";
          e.stopReason = "manual";
        }
      }
    }
    console.log(`alvo: ${alvo.length}`);
    if (!apply) {
      console.log("(dry-run: nada gravado)");
      return;
    }
    await store.saveContacts(contacts);
    await store.saveEnrollments(enrollments);
    console.log("✓ movidos para a reserva; enrollments parados.");
  });
}

void main();

export {};
