// Diagnóstico read-only do ALCANCE da operação (sem PII: contagens por campanha).
// Quem está em sequência ativa, quantos têm LinkedIn utilizável, quantos já tiveram
// toque prévio, e em que passo cada campanha está. Base para decidir toques
// retroativos (conectar no LinkedIn quem já recebe e-mail e ainda não respondeu).
// Uso: pnpm tsx scripts/dev/diagnostico-alcance.ts

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { openStore } = await import("../../src/lib/outbound/store");
  const { linkedinUrl, TOQUE_PREVIO_CUSTOM } = await import("../../src/lib/outbound/toque-previo");
  const s = openStore();
  const [contacts, enrollments, sends, replies] = await Promise.all([
    s.contacts(),
    s.enrollments(),
    s.sends(),
    s.replies(),
  ]);
  const byId = new Map(contacts.map((c) => [c.id, c]));

  const linhas = new Map<
    string,
    {
      ativos: number;
      comLinkedin: number;
      tocados: number;
      passos: Record<string, number>;
      cargos: Record<string, number>;
    }
  >();
  for (const e of enrollments) {
    if (e.status !== "active") continue;
    const c = byId.get(e.contactId);
    if (!c) continue;
    const l = linhas.get(e.campaignSlug) ?? { ativos: 0, comLinkedin: 0, tocados: 0, passos: {}, cargos: {} };
    l.ativos += 1;
    if (linkedinUrl(c)) l.comLinkedin += 1;
    if ((c.custom[TOQUE_PREVIO_CUSTOM] ?? "").trim() !== "") l.tocados += 1;
    const passo = `próximo e${e.nextStep + 1}`;
    l.passos[passo] = (l.passos[passo] ?? 0) + 1;
    const cargo = /s[oó]ci|ceo|diretor|director|presidente|founder|fundador|head|propriet/i.test(c.cargo ?? "")
      ? "decisor"
      : "outros";
    l.cargos[cargo] = (l.cargos[cargo] ?? 0) + 1;
    linhas.set(e.campaignSlug, l);
  }
  console.log("ALCANCE por campanha (sequências ativas):");
  for (const [slug, l] of [...linhas].sort()) {
    console.log(
      `  ${slug}: ${l.ativos} ativos · LinkedIn ${l.comLinkedin} · já tocados ${l.tocados} · ${JSON.stringify(l.passos)} · ${JSON.stringify(l.cargos)}`,
    );
  }
  const pessoasContatadas = new Set(
    sends.filter((x) => x.status === "delivered" || x.status === "sent").map((x) => x.contactId),
  );
  console.log(
    `pessoas que já receberam ao menos 1 e-mail: ${pessoasContatadas.size} · respostas registradas: ${replies.length}`,
  );
}

void main();

export {};
