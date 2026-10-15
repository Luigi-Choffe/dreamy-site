// One-off (2026-10-14): situação de UM contato (por trecho de nome + empresa): e-mail
// (só domínio), verificação, inscrições e envios com status/horário. Só leitura.
// Uso: pnpm tsx scripts/dev/status-contato.ts <nome> <empresa>
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
async function main(): Promise<void> {
  const [nome, empresa] = process.argv.slice(2);
  const { openStore } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const [contacts, enrollments, sends, events] = await Promise.all([store.contacts(), store.enrollments(), store.sends(), store.events()]);
  const alvo = contacts.filter(
    (c) => c.nome.toLowerCase().includes((nome ?? "").toLowerCase()) && (c.empresa ?? "").toLowerCase().includes((empresa ?? "").toLowerCase()),
  );
  for (const c of alvo) {
    console.log(`[${c.id}] ${c.nome} ${c.sobrenome ?? ""} · ${c.cargo} · ${c.empresa} · domínio ${c.email.split("@")[1]} · verif ${c.verification} · status ${c.status} · cesta ${c.custom.cesta ?? "-"}`);
    for (const e of enrollments.filter((e) => e.contactId === c.id)) console.log(`  enrollment ${e.campaignSlug} · ${e.status} · próximo passo ${e.nextStep}`);
    for (const s of sends.filter((s) => s.contactId === c.id)) {
      console.log(`  envio ${s.stepId} · ${s.status} · agendado ${s.scheduledAt} · enviado ${s.sentAt ?? "-"} · resendId ${s.resendEmailId ? "sim" : "não"}`);
      for (const ev of events.filter((ev) => ev.sendId === s.id)) console.log(`    evento ${ev.type} · ${ev.occurredAt ?? ev.recordedAt}`);
    }
  }
  if (alvo.length === 0) console.log("nenhum contato casou");
}
main();
export {};
