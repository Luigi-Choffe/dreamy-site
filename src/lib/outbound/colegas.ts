import { normalizeEmpresa } from "./ops-core";
import type { CampaignStep, Contact, PlanItem } from "./types";

/**
 * `{{frase_colegas}}`: a frase do E1 que cita os colegas da mesma empresa que
 * recebem a sequência junto. Módulo PURO compartilhado por:
 *   - scripts/dev/apply-colegas.ts (grava `custom.frase_colegas` como PREVIEW);
 *   - scripts/outbound/send.ts (recalcula NA HORA do envio a partir do plano do dia).
 *
 * Regra do envio: a frase gravada em custom é só fallback/preview (o plano lint-a
 * com ela). O texto que sai usa os colegas que REALMENTE saem no mesmo plano
 * (mesma empresa, mesma campanha, mesmo passo), então nunca cita quem saiu da
 * sequência nem quem ficou para outro dia.
 */

export const VAR_FRASE_COLEGAS = "frase_colegas";
const FRASE_COLEGAS_RE = /\{\{\s*frase_colegas\s*\}\}/;

/** Variante SOLO: neutra para decisor e operacional (ordem do Luigi, 2026-09-10). */
export const FRASE_SOLO =
  "Escrevo para você primeiro porque, pelo que li do seu perfil, esse assunto passa pela sua mesa.";

export function fraseComColegas(lista: string, empresa: string): string {
  return `Estou escrevendo também para ${lista} aí na ${empresa}, para a conversa chegar em quem vive isso e em quem decide.`;
}

/** "Ana" · "Ana e Carlos" · "Ana, Bia e Carlos". */
export function listaNomes(nomes: string[]): string {
  if (nomes.length === 1) return nomes[0] as string;
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** A frase final: com colegas cita nomes + empresa; sem colegas, a variante solo. */
export function fraseColegas(nomes: string[], empresa: string | undefined): string {
  if (nomes.length === 0) return FRASE_SOLO;
  return fraseComColegas(listaNomes(nomes), empresa?.trim() || "empresa");
}

/** O passo usa a variável (assunto ou corpo)? */
export function usaFraseColegas(step: Pick<CampaignStep, "subject" | "body">): boolean {
  return FRASE_COLEGAS_RE.test(step.subject) || FRASE_COLEGAS_RE.test(step.body);
}

function primeiroNome(contact: Contact): string {
  return contact.nome.trim().split(/\s+/)[0] ?? "";
}

/**
 * Primeiros nomes dos OUTROS contatos da mesma empresa (`normalizeEmpresa`) que
 * estão no MESMO plano, para a mesma campanha e o mesmo passo: os colegas que de
 * fato saem junto. Ordem = ordem do plano (determinística). Contato sem empresa
 * não tem colegas.
 */
export function colegasNoPlano(
  contact: Contact,
  item: Pick<PlanItem, "campaignSlug" | "stepId">,
  items: PlanItem[],
  contactsById: ReadonlyMap<string, Contact>,
): string[] {
  const empresa = normalizeEmpresa(contact.empresa);
  if (empresa === "") return [];
  const nomes: string[] = [];
  for (const other of items) {
    if (other.contactId === contact.id) continue;
    if (other.campaignSlug !== item.campaignSlug || other.stepId !== item.stepId) continue;
    const colega = contactsById.get(other.contactId);
    if (!colega || normalizeEmpresa(colega.empresa) !== empresa) continue;
    const nome = primeiroNome(colega);
    if (nome !== "") nomes.push(nome);
  }
  return nomes;
}

/**
 * Contato pronto para o render do envio: se o passo usa `{{frase_colegas}}`, a
 * variável é recalculada a partir do plano; senão o contato volta intacto (nada
 * muda para as campanhas que não usam a variável).
 */
export function contatoParaEnvio(
  contact: Contact,
  step: Pick<CampaignStep, "subject" | "body">,
  item: Pick<PlanItem, "campaignSlug" | "stepId">,
  items: PlanItem[],
  contactsById: ReadonlyMap<string, Contact>,
): Contact {
  if (!usaFraseColegas(step)) return contact;
  const frase = fraseColegas(colegasNoPlano(contact, item, items, contactsById), contact.empresa);
  return { ...contact, custom: { ...contact.custom, [VAR_FRASE_COLEGAS]: frase } };
}
