// Preenche custom.frase_colegas por contato inscrito numa campanha: a frase do E1
// que menciona os COLEGAS da mesma empresa que também recebem a sequência
// (colegasNaCampanha: só quem tem enrollment ativo, contato ativo e verificado).
// Quem está sozinho na empresa recebe a variante solo (igualmente verdadeira) —
// variável vazia bloqueia o envio no motor, então nunca fica em branco.
// Idempotente: reflete o estado atual das inscrições a cada execução.
// Uso: pnpm tsx scripts/dev/apply-colegas.ts --campanha <slug> [--apply]

const FRASE_COM_COLEGAS = (lista: string, empresa: string): string =>
  `Estou escrevendo também para ${lista} aí na ${empresa}, para a conversa chegar em quem vive isso e em quem decide.`;
const FRASE_SOLO = "Escrevo para você primeiro porque é quem sente isso na ponta.";

function listaNomes(nomes: string[]): string {
  if (nomes.length === 1) return nomes[0] as string;
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const iCamp = args.indexOf("--campanha");
  const slug = iCamp >= 0 ? args[iCamp + 1] : undefined;
  if (!slug) {
    console.error("Uso: pnpm tsx scripts/dev/apply-colegas.ts --campanha <slug> [--apply]");
    process.exit(1);
  }
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  const { colegasNaCampanha } = await import("../../src/lib/outbound/ops-core");

  await runExclusive("apply-colegas", async () => {
    const store = openStore();
    const [contacts, enrollments] = await Promise.all([store.contacts(), store.enrollments()]);
    const inscritos = new Set(
      enrollments.filter((e) => e.campaignSlug === slug && e.status === "active").map((e) => e.contactId),
    );
    let comColegas = 0;
    let solo = 0;
    for (const c of contacts) {
      if (!inscritos.has(c.id)) continue;
      const colegas = colegasNaCampanha(c, contacts, enrollments, slug);
      if (colegas.length > 0) {
        c.custom.frase_colegas = FRASE_COM_COLEGAS(listaNomes(colegas), c.empresa ?? "empresa");
        comColegas++;
      } else {
        c.custom.frase_colegas = FRASE_SOLO;
        solo++;
      }
    }
    console.log(`inscritos: ${inscritos.size} · com colegas: ${comColegas} · solo: ${solo}`);
    if (!apply) {
      console.log("(dry-run: nada gravado; use --apply)");
      return;
    }
    await store.saveContacts(contacts);
    console.log(`✓ frase_colegas gravada em ${comColegas + solo} contato(s).`);
  });
}

void main();

export {};
