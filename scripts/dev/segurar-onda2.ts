// One-off (2026-09-07): devolve os 14 contatos da ONDA 2 da campanha
// validacao-indicacao para "excluded" até a sequência do decisor da empresa
// encerrar (recomendação da auditoria do GARIMPO). A verificação "ok" fica.
// O enroll por indústria pegaria todo ativo elegível — este é o freio da onda.
// Uso: pnpm tsx scripts/dev/segurar-onda2.ts

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  await runExclusive("segurar-onda2", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const alvo = contacts.filter((c) => c.custom.reativacao === "validacao-indicacao 2026-09-07 onda-2");
    if (alvo.length !== 14) throw new Error(`esperava 14 contatos onda-2, achei ${alvo.length} — abortando`);
    for (const c of alvo) {
      c.status = "excluded";
      c.custom.reativacao = "validacao-indicacao aguardando-onda-2 (decisor em sequencia ativa)";
    }
    await store.saveContacts(contacts);
    console.log(`✓ ${alvo.length} contato(s) da onda 2 devolvidos a excluded (verificação preservada).`);
  });
}

void main();

export {};
