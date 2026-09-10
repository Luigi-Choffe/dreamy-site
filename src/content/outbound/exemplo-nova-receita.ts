import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA-MODELO — não é para envio real (industria: "exemplo", status: "draft").
 * Âncora: Nova Receita Digital. Para criar uma campanha real, copie este arquivo e
 * siga GUIA-COPY.md: troque o slug, a industria (valor normalizado da coluna indústria
 * da lista) e a cena do E1 pelo vocabulário do setor. O utm_campaign do link do E3 é
 * o slug da campanha, hardcoded — atualize junto com o slug.
 */

export const exemploNovaReceita: CampaignDefinition = {
  slug: "exemplo-nova-receita",
  industria: "exemplo",
  anchor: "nova-receita",
  status: "draft",
  notes:
    "Modelo para adaptar por indústria real (fit típico: serviços B2B recorrentes com base grande de clientes). " +
    "Ângulo: a base que a empresa já conquistou pode virar uma segunda linha de receita. " +
    "E3 usa a simulação do pitch, sempre rotulada de exemplo (PRD outbound §6) — nunca como promessa.",
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      subject: "uma pergunta sobre a base da {{empresa}}",
      body: `{{nome}}, a {{empresa}} levou anos para conquistar o mais difícil: clientes, confiança, relacionamento. E hoje tudo isso vira receita por um único caminho, o serviço principal.

A pergunta que eu faço a quem lidera uma operação assim: o que MAIS os seus clientes comprariam de você?

Pode ser um portal, uma assinatura, uma ferramenta que resolve uma dor deles. Não precisa ter resposta pronta. Por enquanto, só queria saber se a pergunta faz sentido aí.`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "não precisa ser uma ideia pronta",
      body: `{{nome}}, voltando na pergunta do outro e-mail, um esclarecimento: ninguém chega para a gente com a ideia pronta.

Nossos clientes chegam com uma percepção. “Minha base compraria mais coisas de mim.” “Tem oportunidade parada aqui e eu não sei qual.” O nosso trabalho começa antes do software: entender a base, achar a oportunidade e dizer com honestidade se vale a pena construir algo. Às vezes a resposta é que não vale. E essa resposta também tem valor.

Se quiser testar a pergunta no caso da {{empresa}}, eu topo fazer o exercício com você.`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      subject: "a conta que costuma abrir essa conversa",
      body: `{{nome}}, um exemplo com números redondos (é exemplo mesmo, não promessa): 500 clientes ativos, um produto digital de R$ 149 por mês e um cenário com 70% da base aderindo. Dá R$ 52.150 novos por mês. E cada mês sem o produto no ar é esse valor que fica na mesa.

No diagnóstico, essa simulação é refeita com os números reais da {{empresa}}.

A mecânica está explicada aqui: https://www.dreamy.app.br/solucoes/nova-receita-digital?solucao=nova-receita&utm_source=outbound&utm_medium=email&utm_campaign=exemplo-nova-receita&utm_content=e3

Se preferir, responde este e-mail que eu faço a conta com os seus números.`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "encerro por aqui",
      body: `{{nome}}, este é o meu último e-mail, prometo.

Deixo a mesma pergunta do primeiro: se uma parte dos clientes da {{empresa}} pagasse por um produto digital seu, o que valeria a pena construir?

Se um dia fizer sentido, a porta está aberta, é só responder. E se não fizer, me diz que eu paro por aqui e não escrevo de novo.`,
    },
  ],
};
