import { campaigns } from "../../src/content/outbound";
import { buildEmail } from "../../src/lib/outbound/render";
import { openStore } from "../../src/lib/outbound/store";
const slug = process.argv[2] ?? "construcao-nova-receita";
const campaign = campaigns.find((c) => c.slug === slug)!;
async function main() {
  const store = openStore();
  const [contacts, enrollments] = await Promise.all([store.contacts(), store.enrollments()]);
  const enrolled = enrollments.filter((e) => e.campaignSlug === slug);
  const contact = contacts.find((c) => c.id === enrolled[0]?.contactId);
  if (!contact) throw new Error("nenhum contato inscrito");
  console.log(`Contato de exemplo: ${contact.nome} · ${contact.cargo} · ${contact.empresa}`);
  for (const step of campaign.steps) {
    const built = buildEmail(contact, campaign, step, { replyTo: "contact@bedreamy.com.br" });
    console.log(
      `\n============ ${step.id.toUpperCase()} (dia ${step.offsetDays === 0 ? "0" : "+" + step.offsetDays}) ============`,
    );
    console.log(`Assunto: ${built.subject}\n`);
    console.log(built.text);
  }
}
main();
