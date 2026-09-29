// One-off (2026-09-25): leitura da prontidão da onda 2 da validacao-indicacao.
// Para cada contato marcado onda-2: status, verificação, e se ainda existe
// enrollment ATIVO de alguém da mesma empresa (regra: onda 2 só entra quando a
// sequência do decisor encerrar). Não grava nada.
import type { Contact, Enrollment } from "../../src/lib/outbound/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function main(): Promise<void> {
  const { openStore } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const [contacts, enrollments, supp] = await Promise.all([
    store.contacts(),
    store.enrollments(),
    store.suppressions(),
  ]);
  const suprimidos = new Set(supp.map((s) => s.email.toLowerCase()));
  const onda2 = contacts.filter((c) => String(c.custom?.reativacao ?? "").includes("onda-2"));
  const ativosPorEmpresa = new Map<string, Enrollment[]>();
  const byId = new Map<string, Contact>(contacts.map((c) => [c.id, c]));
  for (const e of enrollments.filter((x) => x.status === "active")) {
    const emp = (byId.get(e.contactId)?.empresa ?? "").toLowerCase();
    ativosPorEmpresa.set(emp, [...(ativosPorEmpresa.get(emp) ?? []), e]);
  }
  let prontos = 0;
  for (const c of onda2) {
    const jaInscrito = enrollments.some((e) => e.contactId === c.id && e.campaignSlug === "validacao-indicacao");
    const bloqueio = ativosPorEmpresa.get((c.empresa ?? "").toLowerCase()) ?? [];
    const sup = suprimidos.has(c.email.toLowerCase());
    const ok = !jaInscrito && bloqueio.length === 0 && !sup && c.status === "active" && c.verification === "ok";
    if (ok) prontos += 1;
    console.log(
      `${ok ? "PRONTO " : "espera "} ${c.nome} ${c.sobrenome ?? ""} · ${c.empresa} · status ${c.status} · verif ${c.verification}` +
        `${jaInscrito ? " · JÁ INSCRITO" : ""}${sup ? " · SUPRIMIDO" : ""}` +
        `${bloqueio.length ? ` · ${bloqueio.length} sequência(s) ativa(s) na empresa (${bloqueio.map((b) => b.campaignSlug).join(", ")})` : ""}`,
    );
  }
  console.log(`onda 2: ${onda2.length} marcados · ${prontos} prontos`);
}
main();
