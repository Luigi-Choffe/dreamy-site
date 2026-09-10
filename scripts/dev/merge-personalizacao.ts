/**
 * Mescla PEÇAS PERSONALIZADAS POR CONTATO (JSON {pecas:[{contactId, abertura, gancho}]})
 * em contact.custom e VALIDA cada uma: regras de forma da casa + (se a campanha
 * já existir no registro) render do E1 real com lint. Padrão irmão do
 * merge-aberturas.ts, mas por contato (a lista de logística personaliza pessoa
 * a pessoa a partir do LinkedIn, não só a empresa).
 *
 * Uso: pnpm tsx scripts/dev/merge-personalizacao.ts <pecas.json> --campanha <slug> [--apply]
 *   sem --apply: só valida e imprime o relatório (nada gravado)
 */
import { readFileSync } from "node:fs";

interface Peca {
  contactId: string;
  /** Uma ou duas frases sobre a pessoa/empresa; funciona após "{{nome}}, "; minúscula; termina em ponto. */
  abertura: string;
  /** A ponte entre o cargo dela e a dor; frase(s) completa(s), começa maiúscula, termina em ponto. */
  gancho: string;
}

const TRAVESSAO = /[—–]/;

function issuesAbertura(s: string): string[] {
  const out: string[] = [];
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words < 8) out.push(`abertura curta (${words} palavras, mín. 8)`);
  if (words > 22) out.push(`abertura longa (${words} palavras, máx. 22: o E1 estoura 140 com a assinatura)`);
  if (!/^[a-zà-ü]/.test(s)) out.push("abertura não começa com minúscula");
  if (!/\.$/.test(s.trim())) out.push("abertura não termina com ponto");
  if (TRAVESSAO.test(s)) out.push("abertura com travessão");
  if (/\{\{|\}\}/.test(s)) out.push("abertura com chaves {{}}");
  if (/[!"“”]/.test(s)) out.push("abertura com exclamação/aspas");
  if (/impressionante|parabéns|referência no|líder de mercado|incrível|admir/i.test(s))
    out.push("abertura com elogio proibido");
  if (/\b[A-ZÀ-Ü]{4,}\b/.test(s)) out.push("abertura com palavra em caixa alta");
  return out;
}

function issuesGancho(s: string): string[] {
  const out: string[] = [];
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words < 10) out.push(`gancho curto (${words} palavras, mín. 10)`);
  if (words > 22) out.push(`gancho longo (${words} palavras, máx. 22: o E1 estoura 140 com a assinatura)`);
  if (!/^[A-ZÀ-Ü]/.test(s)) out.push("gancho não começa com maiúscula");
  if (!/[.?]$/.test(s.trim())) out.push("gancho não termina com ponto ou interrogação");
  if (TRAVESSAO.test(s)) out.push("gancho com travessão");
  if (/\{\{|\}\}/.test(s)) out.push("gancho com chaves {{}}");
  if (/[!"“”]/.test(s)) out.push("gancho com exclamação/aspas");
  if (/\b[A-ZÀ-Ü]{4,}\b/.test(s)) out.push("gancho com palavra em caixa alta");
  return out;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  const iCamp = args.indexOf("--campanha");
  const slug = iCamp >= 0 ? args[iCamp + 1] : undefined;
  if (!file || !slug) {
    console.error("Uso: pnpm tsx scripts/dev/merge-personalizacao.ts <pecas.json> --campanha <slug> [--apply]");
    process.exit(1);
  }

  const { pecas } = JSON.parse(readFileSync(file, "utf8")) as { pecas: Peca[] };
  const { campaigns } = await import("../../src/content/outbound");
  const { buildEmail, lintEmail, lintErrors } = await import("../../src/lib/outbound/render");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");
  const campaign = campaigns.find((c) => c.slug === slug);
  if (!campaign) console.log(`(campanha "${slug}" ainda não registrada: validando só a forma, sem render)`);

  await runExclusive("merge-personalizacao", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const byId = new Map(contacts.map((c) => [c.id, c]));
    let ok = 0;
    let semFraseColegas = 0;
    const problemas: string[] = [];

    for (const p of pecas) {
      const c = byId.get(p.contactId);
      if (!c) {
        problemas.push(`${p.contactId}: contato não existe`);
        continue;
      }
      const abertura = p.abertura.trim().replace(/\s+/g, " ");
      const gancho = p.gancho.trim().replace(/\s+/g, " ");
      const issues = [...issuesAbertura(abertura), ...issuesGancho(gancho)];
      if (issues.length === 0 && campaign) {
        // O E1 usa {{frase_colegas}} (gravada por apply-colegas.ts, que depende das
        // inscrições). Antes disso existir, sondamos com a variante mais LONGA
        // (3 colegas + nome da empresa) para a contagem de palavras ser conservadora.
        const fraseColegas =
          c.custom.frase_colegas ??
          `Estou escrevendo também para Fulano, Beltrano e Sicrano aí na ${c.empresa ?? "empresa"}, para a conversa chegar em quem vive isso e em quem decide.`;
        if (!c.custom.frase_colegas) semFraseColegas++;
        const sonda = { ...c, custom: { ...c.custom, abertura, gancho, frase_colegas: fraseColegas } };
        try {
          const b = buildEmail(sonda, campaign, campaign.steps[0], { replyTo: "contact@bedreamy.com.br" });
          const errs = lintErrors(lintEmail(b.subject, b.text, { subjectTemplate: campaign.steps[0].subject }));
          for (const e of errs) issues.push(`lint E1: ${e.rule} (${e.detail})`);
        } catch (e) {
          issues.push(`render E1: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (issues.length > 0) {
        problemas.push(`${c.nome} · ${c.empresa}: ${issues.join("; ")}`);
        continue;
      }
      ok++;
      if (apply) {
        c.custom.abertura = abertura;
        c.custom.gancho = gancho;
      }
    }

    console.log(`peças: ${pecas.length} · válidas: ${ok} · com problema: ${problemas.length}`);
    if (semFraseColegas > 0) {
      console.log(
        `  (${semFraseColegas} contato(s) ainda sem custom.frase_colegas: render sondado com a variante longa; rode apply-colegas.ts antes do envio)`,
      );
    }
    for (const p of problemas) console.log(`  ✖ ${p}`);
    if (apply) {
      if (problemas.length > 0) {
        console.log("NADA gravado: corrija as peças com problema e rode de novo (tudo ou nada).");
        return;
      }
      await store.saveContacts(contacts);
      console.log(`✓ ${ok} contato(s) atualizados com abertura + gancho.`);
    } else {
      console.log("(dry-run: nada gravado; use --apply para mesclar)");
    }
  });
}

void main();

export {};
