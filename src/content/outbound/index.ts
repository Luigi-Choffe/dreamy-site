import type { CampaignDefinition } from "../../lib/outbound/types";
import { construcaoNovaReceita } from "./construcao-nova-receita";
import { engenhariaAgentesIa } from "./engenharia-agentes-ia";
import { exemploAgentes } from "./exemplo-agentes";
import { exemploNovaReceita } from "./exemplo-nova-receita";
import { exemploSistemas } from "./exemplo-sistemas";
import { obrasSistemasSobMedida } from "./obras-sistemas-sob-medida";
import { validacaoIndicacao } from "./validacao-indicacao";

/**
 * Registro das campanhas de outbound (copy versionada — PRD outbound §20).
 * Dashboard e CLI leem deste array; campanhas `draft` nunca são elegíveis para envio.
 */
export const campaigns: CampaignDefinition[] = [
  construcaoNovaReceita,
  obrasSistemasSobMedida,
  engenhariaAgentesIa,
  validacaoIndicacao,
  exemploNovaReceita,
  exemploSistemas,
  exemploAgentes,
];

// Unicidade de slug em tempo de módulo: slug duplicado quebraria aprovação,
// idempotência de envio e atribuição (utm_campaign) — falha cedo e alto.
const seen = new Set<string>();
for (const campaign of campaigns) {
  if (seen.has(campaign.slug)) {
    throw new Error(`Registry de campanhas: slug duplicado "${campaign.slug}" (src/content/outbound).`);
  }
  seen.add(campaign.slug);
}

export function getCampaign(slug: string): CampaignDefinition | undefined {
  return campaigns.find((c) => c.slug === slug);
}
