import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA REAL — logística (operadores logísticos, SP, 2026-09).
 * Âncora: Nova Receita Digital. Tese: o galpão que dá ao cliente dele visibilidade
 * e autonomia sobre o estoque armazenado deixa de vender metro quadrado e passa a
 * vender serviço digital, com margem que a operação física não tem.
 *
 * ALVO (~69 pessoas em 28 empresas): decisores (sócio/CEO/diretor/head) E
 * operacionais que vivem a dor (gerente/coordenador/supervisor de operações,
 * logística, armazém, frota, torre de controle, TI, qualidade) e alguns
 * comerciais/CS. Em 14 empresas não há decisor na lista: o operacional é a
 * porta para chegar em quem decide (E4 pede o encaminhamento explícito).
 *
 * CASE (E2): cliente da Dreamy, operador de galpão em SP (armazenagem para
 * terceiros). App de gestão do estoque armazenado que virou receita: os clientes
 * do galpão pagam para gerir o próprio estoque e pedir retirada/entrega por ele.
 * SEM nome do cliente, SEM link do produto. Números usados (página do produto):
 * mais de 50 empresas, mais de 12 mil ativos. NUNCA valores em R$ do case (são de
 * dashboard de demonstração). A conta do E3 é exemplo rotulado (PRD §6).
 *
 * SLOTS do E1 (variáveis `custom` por contato, escritas pelo GARIMPO a partir do
 * LinkedIn; o motor bloqueia envio se faltar qualquer uma):
 *   {{abertura}}      1 a 2 frases sobre a pessoa/empresa; vem após "{{nome}}, ",
 *                     começa minúscula, termina em ponto. Até 22 palavras.
 *   {{gancho}}        1 a 2 frases ligando o cargo da pessoa à dor (planilha/WMS
 *                     que não conversa, cliente ligando para saber do estoque,
 *                     retirada por e-mail e WhatsApp). Começa maiúscula, termina
 *                     em ponto ou interrogação. Até 22 palavras.
 *   {{frase_colegas}} UMA frase pronta. Com colegas na lista: "Estou escrevendo
 *                     também para X e Y aí na Empresa, para a conversa chegar em
 *                     quem vive isso e em quem decide." Sozinho: "Escrevo para
 *                     você primeiro porque é quem sente isso na ponta." O motor
 *                     garante o envio aos colegas no mesmo dia.
 * Limite de tamanho: espinha do E1 (~40 palavras) + 3 slots + assinatura (18)
 * precisa ficar em 140 palavras ou menos (lint bloqueia acima). Com os slots
 * no limite (22+22+23) o E1 rende ~125 palavras: sobra margem de ~15.
 *
 * Status "draft" até o Luigi aprovar (outbound:campaign approve — ADR-020).
 */

export const logisticaEstoqueReceita: CampaignDefinition = {
  slug: "logistica-estoque-receita",
  industria: "logística",
  anchor: "nova-receita",
  status: "draft",
  notes:
    "Lote logística SP 2026-09 (~69 contatos em 28 operadores logísticos; decisores + operacionais de propósito, 14 empresas sem decisor). " +
    "E1 hiperpersonalizado por slots (abertura, gancho, frase_colegas) com espinha curta; E2 narra o case do galpão que virou receita (sem nome, sem link); " +
    "E3 traz a conta rotulada como exemplo e o único link (UTM = slug); E4 encerra com opt-out humano e pede encaminhamento ao sócio/diretor. " +
    "Copy centrada em armazenagem (estoque armazenado, retirada); para transportadora/forwarder o gancho por pessoa faz a adaptação (carga, posição, coleta).",
  sampleCustom: {
    abertura:
      "vi que você coordena a operação de armazém aí e que vocês guardam estoque de terceiros na Grande São Paulo.",
    gancho:
      "Imagino que parte do seu dia vá em responder cliente sobre o que está no galpão e em receber retirada por e-mail e WhatsApp.",
    frase_colegas:
      "Estou escrevendo também para Ana e Carlos aí na Acme Distribuidora, para a conversa chegar em quem vive isso e em quem decide.",
  },
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      // Nome da empresa ABRE o assunto, sem artigo (concordância de gênero varia
      // por nome e denuncia mala direta). Sem link, sem número.
      subject: "{{empresa}} e o cliente que pergunta do estoque",
      body: `{{nome}}, {{abertura}}

{{gancho}}

Eu construo software sob medida, e a parte que mais vejo virar produto em operador logístico é essa: o cliente consultando e pedindo sozinho. {{frase_colegas}}

Como o cliente de vocês consulta hoje o que está com vocês e pede uma retirada ou uma coleta?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "o app que rende mais que o galpão",
      body: `{{nome}}, te conto um caso meu, sem citar o nome.

Um cliente meu opera galpão em São Paulo, armazenagem para terceiros. Mesma cena: cliente ligando para saber do estoque, retirada por e-mail e WhatsApp. Construímos um app em que o cliente dele vê o que tem armazenado, confere o inventário e pede retirada e entrega por ali.

O que ninguém planejou: os clientes do galpão passaram a pagar pelo app. Hoje ele gera mais receita do que o próprio serviço de logística. Mais de 50 empresas usam, mais de 12 mil ativos gerenciados, sem um metro quadrado a mais.

Quanto do tempo da operação de vocês hoje vai em responder cliente sobre estoque?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      subject: "uma conta simples sobre a operação de vocês",
      body: `{{nome}}, faz essa conta comigo. Números redondos, só um exemplo:

50 clientes na operação, R$ 600 por mês para cada um gerir o próprio estoque e pedir retirada pelo app, 30% de adesão. Dá R$ 9.000 por mês de receita nova. Sem um metro quadrado a mais, sem um caminhão a mais.

O operador que dá ao cliente visibilidade e autonomia sobre o que está guardado deixa de vender só espaço e passa a vender serviço digital, com margem que a operação física não tem. No diagnóstico, refazemos a conta com os números de vocês.

Escrevi como pensamos isso aqui: https://www.dreamy.app.br/solucoes/nova-receita-digital?solucao=nova-receita&utm_source=outbound&utm_medium=email&utm_campaign=logistica-estoque-receita&utm_content=e3

Se preferir, responde que eu te mostro com a realidade de vocês.`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "encerro por aqui",
      body: `{{nome}}, último e-mail, prometo. Sua caixa já tem ruído demais.

Se o cliente de vocês já consulta e pede tudo sozinho, ótimo, vocês estão na frente da maioria. Se ainda passa por telefone e e-mail, a porta fica aberta, sem pressa. Basta responder aqui.

E se essa decisão não é sua, me faz um favor e encaminha esta conversa para o sócio ou diretor que cuida disso? Eu continuo daí.

Se o assunto não for para vocês, me diz que eu não escrevo de novo.`,
    },
  ],
};
