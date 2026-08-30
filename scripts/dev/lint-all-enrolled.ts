import { campaigns } from "../../src/content/outbound";
import { buildEmail, lintEmail, lintErrors } from "../../src/lib/outbound/render";
import { openStore } from "../../src/lib/outbound/store";
const slug = "construcao-nova-receita";
const campaign = campaigns.find((c) => c.slug === slug)!;
async function main() {
  const store = openStore();
  const [contacts, enrollments] = await Promise.all([store.contacts(), store.enrollments()]);
  const enrolled = enrollments.filter((e) => e.campaignSlug === slug);
  let ok = 0;
  const problems: string[] = [];
  for (const en of enrolled) {
    const c = contacts.find((x) => x.id === en.contactId)!;
    for (const step of campaign.steps) {
      try {
        const b = buildEmail(c, campaign, step, { replyTo: "contact@bedreamy.com.br" });
        const errs = lintErrors(lintEmail(b.subject, b.text, { subjectTemplate: step.subject }));
        if (errs.length)
          problems.push(`${c.empresa} ${step.id}: ${errs.map((e) => e.rule + " (" + e.detail + ")").join("; ")}`);
        else ok++;
      } catch (e) {
        problems.push(`${c.empresa} ${step.id}: render: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  console.log(`renderizações ok: ${ok}/${enrolled.length * campaign.steps.length}`);
  for (const p of problems) console.log("  ✖", p);
}
main();
