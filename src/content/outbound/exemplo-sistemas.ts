import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA-MODELO — não é para envio real (industria: "exemplo", status: "draft").
 * Âncora: Sistemas Sob Medida. Para criar uma campanha real, copie este arquivo e
 * siga GUIA-COPY.md: troque o slug, a industria (valor normalizado da coluna indústria
 * da lista) e a cena do E1 pelo vocabulário do setor. O utm_campaign do link do E3 é
 * o slug da campanha, hardcoded — atualize junto com o slug.
 */

export const exemploSistemas: CampaignDefinition = {
  slug: "exemplo-sistemas",
  industria: "exemplo",
  anchor: "sistema",
  status: "draft",
  notes:
    "Modelo para adaptar por indústria real (fit típico: distribuição/atacado e operações com ERP + planilhas paralelas). " +
    "Ângulo: a cena 'o ERP diz uma coisa, o vendedor vê outra' — o sistema construído em volta do processo, não o contrário. " +
    "E3 cita um único dado de mercado com fonte (McKinsey), os únicos números permitidos (PRD outbound §6).",
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      subject: "pedidos em planilha na {{empresa}}?",
      body: `{{nome}}, uma cena que aparece muito em empresas de {{industria}}: o ERP diz uma coisa, o vendedor vê outra, e no meio existe uma planilha que só uma pessoa entende.

Nada disso é falta de competência. É a empresa que cresceu mais rápido do que a tecnologia dela. E software pronto foi feito para a média, não para o seu processo.

A gente constrói o contrário: o sistema em volta da sua operação, do jeito que ela funciona de verdade.

Essa cena acontece aí na {{empresa}}, ou esse capítulo já está resolvido?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "o sistema em volta do processo, não o contrário",
      body: `{{nome}}, um complemento ao e-mail anterior, porque essa parte costuma travar a conversa: você não precisa chegar sabendo o que construir.

Nenhum cliente nosso chegou com especificação. Chegam com uma dor: “isso demora demais”, “não enxergo minha operação”, “duas áreas trabalham com números diferentes”. O desenho a gente faz junto. Você conhece o seu negócio; nós conhecemos tecnologia. E quando o diagnóstico mostra que não vale a pena construir nada, a gente fala isso também.

Qual parte da operação da {{empresa}} depende hoje de planilha e de boa vontade?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      subject: "88% já usam ia em pelo menos uma função",
      body: `{{nome}}, um dado de mercado, com a fonte junto: 88% das empresas no mundo já usam IA em pelo menos uma função, ante 78% um ano antes (McKinsey, State of AI 2025).

O que o número não conta é onde a tecnologia vira resultado. Quase nunca é no lugar óbvio. Costuma ser naquele processo específico da operação que nenhum software pronto atende direito.

Como a gente ataca isso está descrito aqui: https://www.dreamy.app.br/solucoes/sistemas-sob-medida?solucao=sistema&utm_source=outbound&utm_medium=email&utm_campaign=exemplo-sistemas&utm_content=e3

E se for mais fácil, responde por aqui que eu explico como isso se aplicaria à {{empresa}}.`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "último e-mail, prometo",
      body: `{{nome}}, encerro por aqui para não virar ruído na sua caixa de entrada.

Fica só a pergunta de sempre: qual processo da {{empresa}} valeria a pena tirar da planilha este ano? Se em algum momento fizer sentido conversar sobre isso, é só responder este e-mail.

E se o assunto não fizer sentido para vocês, me diz que eu paro por aqui e não escrevo mais.`,
    },
  ],
};
