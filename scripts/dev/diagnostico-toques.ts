// One-off (2026-10-15): confere a fila de toques contra os E1 processados. Só leitura.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
async function main(): Promise<void> {
  const { openStore } = await import("../../src/lib/outbound/store");
  const { linkedinUrl, TOQUE_PREVIO_KIND } = await import("../../src/lib/outbound/toque-previo");
  const store = openStore();
  const [contacts, sends, tasks] = await Promise.all([store.contacts(), store.sends(), store.tasks()]);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const e1 = sends.filter((s) => s.stepId === "e1" && s.campaignSlug.startsWith("controladoria"));
  const porStatus = new Map<string, number>();
  for (const s of e1) porStatus.set(s.status, (porStatus.get(s.status) ?? 0) + 1);
  console.log("E1 controladoria por status:", [...porStatus.entries()].map(([k, v]) => `${k}=${v}`).join(" · "));
  const processados = e1.filter((s) => s.status === "sent" || s.status === "delivered").map((s) => byId.get(s.contactId)!);
  const semPerfil = processados.filter((c) => !linkedinUrl(c)).length;
  const jaToque = processados.filter((c) => String(c.custom.toque_previo ?? "").trim()).length;
  const abertas = tasks.filter((t) => t.kind === TOQUE_PREVIO_KIND && t.status === "aberta");
  const concluidas = tasks.filter((t) => t.kind === TOQUE_PREVIO_KIND && t.status === "concluida" && processados.some((c) => c.id === t.contactId)).length;
  console.log(`processados ${processados.length} · sem perfil ${semPerfil} · já com toque ${jaToque} · tarefas abertas ${abertas.length} · concluídas entre eles ${concluidas}`);
}
main();
export {};
