import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA REAL — construção/incorporação (lote Clay "Luigi_CONSTRUCAO", SP, 2026-08).
 * Âncora: Nova Receita Digital. Tese: depois da entrega das chaves a relação com o
 * comprador morre e a base vira arquivo morto — sendo que é uma base de altíssima
 * confiança (a pessoa fez a maior compra da vida com a marca).
 *
 * {{abertura}} vem do enriquecimento por empresa (outbound:companies — uma linha
 * escrita a partir da descrição real de cada empresa; funciona após "{{nome}}, ",
 * começa minúscula e termina em ponto). O motor bloqueia envio se faltar.
 *
 * Status "draft" até o usuário aprovar (outbound:campaign approve — ADR-020).
 */

export const construcaoNovaReceita: CampaignDefinition = {
  slug: "construcao-nova-receita",
  // Segmento curado da tabela de empresas (apply-segmentos): SÓ incorporadoras —
  // a tese "depois das chaves" não serve para construtora de obra, fornecedor ou
  // serviço de engenharia (esses ganham campanhas próprias depois).
  industria: "construção incorporadora",
  anchor: "nova-receita",
  // "ready" + aprovação registrada em 2026-08-27 ("OK, aprovado, pode seguir!" — Luigi).
  status: "ready",
  notes:
    "Lote Clay construção SP 2026-08 (99 empresas, segmentadas — esta campanha mira só o segmento incorporadora). " +
    "Dor traduzida: pós-chaves sem relacionamento; assistência técnica como custo; base de compradores monetizada zero. " +
    "E3 usa a mecânica do simulador do pitch SEMPRE rotulada como exemplo (PRD outbound §6).",
  sampleCustom: {
    abertura:
      "vi que vocês incorporam e administram empreendimentos residenciais na Grande São Paulo. Cada entrega vira uma carteira nova de clientes.",
  },
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      // Nome da empresa ABRE o assunto (sem artigo: "a/o Grupo GPE" varia por nome e
      // erro de concordância denuncia mala-direta). Travessão é proibido (lint).
      subject: "{{empresa}} depois da entrega das chaves",
      body: `{{nome}}, {{abertura}}

Escrevo porque vejo o mesmo padrão em quase toda incorporadora: a entrega das chaves encerra a relação com o comprador. A pessoa acabou de fazer a compra mais importante da vida dela com a sua marca. No mês seguinte, já está pagando a terceiros por serviço que podia ter o seu nome.

Meu trabalho é transformar esse tipo de base em produto digital. Software sob medida, desenhado em cima da operação de vocês.

Vale vinte minutos de conversa sobre o que a sua base compraria de você?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "você não precisa saber o que construir",
      body: `{{nome}}, complemento rápido ao que te mandei.

A objeção que mais escuto é essa: "não sei o que eu pediria para construir". Nenhum cliente nosso soube. Eles chegaram com uma dor concreta. O pós-venda vive de planilha e telefone. A assistência técnica só gera custo. Depois da entrega, ninguém mais fala com o comprador.

O desenho da solução é trabalho nosso, feito junto com vocês. E quando a conta não fecha, eu sou o primeiro a dizer que não vale construir nada.

Do seu lado, qual dessas dores aparece primeiro?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      subject: "uma conta de padaria sobre a sua base",
      body: `{{nome}}, faz essa conta comigo. Números redondos, é só um exemplo:

500 clientes na base, R$ 149 por mês, 30% de adesão. Dá R$ 22.350 por mês de receita nova. Sem lançar um empreendimento a mais.

O produto que sustenta essa conta muda de operação para operação. Portal do proprietário, pós-entrega por assinatura, clube de manutenção dos empreendimentos entregues. No diagnóstico, refazemos a conta com os seus números reais.

Escrevi como pensamos isso aqui: https://www.dreamy.app.br/solucoes/nova-receita-digital?solucao=nova-receita&utm_source=outbound&utm_medium=email&utm_campaign=construcao-nova-receita&utm_content=e3

Se preferir, responde que eu te mostro com a realidade de vocês.`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "encerro por aqui",
      body: `{{nome}}, último e-mail, prometo. Sua caixa já tem ruído demais.

Deixo só a pergunta que abre toda boa conversa com incorporadora: o que MAIS os seus clientes comprariam de você depois das chaves? Quando fizer sentido pensar nisso, é só responder aqui.

E se o assunto não for para vocês, me diz que eu não escrevo de novo.`,
    },
  ],
};
