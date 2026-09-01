/**
 * One-off: valida uma campanha DRAFT contra os contatos reais do segmento-alvo
 * ANTES de inscrever (render + lint por passo, com a assinatura fora do corpo).
 * Uso: pnpm tsx scripts/dev/lint-campanha-alvo.ts <slug>
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}
import { campaigns } from "../../src/content/outbound";
import { buildEmail, lintEmail, lintErrors } from "../../src/lib/outbound/render";
import { openStore } from "../../src/lib/outbound/store";

async function main() {
  const slug = process.argv[2];
  const campaign = campaigns.find((c) => c.slug === slug);
  if (!campaign) {
    console.error(`campanha "${slug}" não existe no registro.`);
    process.exit(1);
  }
  const store = openStore();
  const contacts = await store.contacts();
  const alvo = contacts.filter((c) => c.status === "active" && c.industria === campaign.industria);
  let ok = 0;
  const problems: string[] = [];
  for (const c of alvo) {
    for (const step of campaign.steps) {
      try {
        const b = buildEmail(c, campaign, step, { replyTo: "contact@bedreamy.com.br" });
        const errs = lintErrors(lintEmail(b.subject, b.text, { subjectTemplate: step.subject }));
        if (errs.length)
          problems.push(`${c.empresa} ${step.id}: ${errs.map((e) => e.rule + " (" + e.detail + ")").join("; ")}`);
        else ok += 1;
      } catch (e) {
        problems.push(`${c.empresa} ${step.id}: render: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  console.log(
    `${slug}: alvo ${alvo.length} contato(s) · renderizações ok ${ok}/${alvo.length * campaign.steps.length}`,
  );
  for (const p of problems) console.log("  x", p);
  if (problems.length) process.exit(1);
}

main();
