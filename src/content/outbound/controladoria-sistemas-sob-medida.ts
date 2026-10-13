import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA REAL — controladoria/finanças de empresas médias (lista Clay, SP, 2026-10).
 * Âncora: Sistemas Sob Medida. Ângulo pedido pelo Luigi: "foco nos dashs". O controller
 * vive montando painel e fechamento na mão: extrai do ERP para a planilha, cruza folha,
 * banco e orçamento, acerta o de-para e só então o Power BI atualiza. O dado existe desde
 * o primeiro dia do mês; o número chega depois da pergunta da diretoria. O que vendemos é
 * a camada do meio: software construído em volta da operação, que leva o dado do ERP
 * direto ao painel, sem a planilha no caminho.
 *
 * ALVO (~410 pessoas; 59 empresas com 2+ contatos): Controller, Gerente/Coordenador de
 * Controladoria, Head de FP&A, Diretor de Controladoria, CFO de empresa média. Como na
 * logística, {{frase_colegas}} entra no E1 para a conversa chegar em quem monta o número
 * e em quem decide.
 *
 * PROVA (E3): o case do galpão SEM nome (prova cruzada aprovada em 2026-09-14): operador
 * logístico de galpão em SP; a Dreamy construiu um app em que os clientes veem o estoque
 * e pedem retirada/entrega; mais de 50 empresas, mais de 12 mil ativos. Enquadrado como
 * "sistema construído em volta da operação: o dado que vive na operação chega pronto no
 * painel". NUNCA valores em R$, NUNCA nome, NUNCA link do produto.
 *
 * SLOTS do E1 (variáveis `custom` por contato, escritas pelo GARIMPO a partir do
 * Sobre/headline do LinkedIn; o motor bloqueia envio se faltar qualquer uma):
 *   {{abertura}}      1 a 2 frases sobre a pessoa/empresa (controladoria, FP&A,
 *                     consolidação, orçado x realizado, ERP). Vem após "{{nome}}, ",
 *                     começa minúscula, termina em ponto. Até 22 palavras.
 *   {{gancho}}        1 a 2 frases ligando o cargo da pessoa à dor (fechamento que sai
 *                     do ERP para a planilha, painel alimentado na mão, diretoria que
 *                     pergunta antes de o painel atualizar). Começa maiúscula, termina
 *                     em ponto ou interrogação. Até 22 palavras.
 *   {{frase_colegas}} UMA frase pronta. Com colegas na lista: "Estou escrevendo também
 *                     para X e Y aí na Empresa, para a conversa chegar em quem monta o
 *                     número e em quem decide." Sozinho: "Escrevo para você primeiro
 *                     porque é quem monta esse número na ponta." Até 23 palavras.
 * Contrato de tamanho (molde v3): espinha do E1 (31 palavras: nome, linha da oferta,
 * pergunta) + abertura (22) + gancho (22) = 75, dentro da faixa 71 a 76; frase_colegas
 * (23) leva a 98; a assinatura anexada pelo motor (18) fecha em 116, abaixo do teto
 * de 140 do lint.
 *
 * Status "draft" até o Luigi aprovar (outbound:campaign approve — ADR-020).
 */

export const controladoriaSistemasSobMedida: CampaignDefinition = {
  slug: "controladoria-sistemas-sob-medida",
  titulo: "Controladoria",
  industria: "controladoria",
  anchor: "sistema",
  status: "draft",
  notes:
    "Lista Clay controladoria SP 2026-10 (~410 contatos; 59 empresas com 2+ pessoas). Ângulo: foco nos dashs (painel e fechamento montados na mão, " +
    "número chega depois da pergunta da diretoria). E1 molde v3 com slots (abertura, gancho, frase_colegas); E2 remove a objeção 'já temos Power BI' " +
    "(o problema é a camada que alimenta o painel) e tira o peso da especificação; E3 traz o case do galpão como prova cruzada e o único link (UTM = slug); " +
    "E4 encerra com resposta de uma palavra ('painel') e opt-out humano.",
  sampleCustom: {
    abertura:
      "vi que você responde pela controladoria e pelo planejamento aí, com fechamento mensal e consolidação de mais de uma empresa.",
    gancho:
      "Imagino que boa parte do fechamento ainda saia do ERP para a planilha antes de virar o painel que a diretoria vê.",
    frase_colegas:
      "Estou escrevendo também para Ana e Carlos aí na Acme Distribuidora, para a conversa chegar em quem monta o número e em quem decide.",
  },
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      // Nome da empresa ABRE o assunto, sem artigo (concordância de gênero varia
      // por nome e denuncia mala direta). Sem link, sem número.
      subject: "{{empresa}} e o painel montado na mão",
      body: `{{nome}}, {{abertura}}

{{gancho}}

Eu construo software sob medida em cima da operação, para o número sair do ERP direto no painel, sem passar pela planilha. {{frase_colegas}}

Isso acontece aí também, ou estou chutando longe?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "a planilha entre o sistema e o painel",
      body: `{{nome}}, complemento ao e-mail anterior.

A objeção que mais escuto é "a gente já tem Power BI". O painel não é o problema, é o que alimenta ele: alguém extrai do ERP, cruza folha, banco e orçamento na planilha, acerta o de-para, e só então o painel atualiza. O dado existe desde o dia primeiro. O número chega depois da pergunta.

Essa camada do meio é o que eu construo, encaixada no ERP de vocês. Você não precisa saber o que construir: o desenho é trabalho nosso, com quem monta o número hoje.

Qual relatório do fechamento ainda sai da planilha aí?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      // Case do galpão como prova cruzada (sem nome, sem link do produto, sem R$).
      subject: "um caso meu fora de finanças",
      body: `{{nome}}, te conto um caso meu, sem citar o nome.

Um cliente meu opera galpão em São Paulo. O cliente dele ligava para saber do estoque e pedia retirada por e-mail e WhatsApp. Construímos um sistema em volta da operação: o dado nasce onde a coisa acontece e chega pronto na tela de quem pergunta. Hoje mais de 50 empresas usam e pagam por ele.

Na controladoria é igual: o lançamento já está no ERP, falta a camada que leva ele ao painel sem a planilha no meio.

Escrevi como pensamos isso: https://www.dreamy.app.br/solucoes/sistemas-sob-medida?solucao=sistema&utm_source=outbound&utm_medium=email&utm_campaign=controladoria-sistemas-sob-medida&utm_content=e3

Quantos dias depois do fechamento a diretoria vê o número aí?`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "encerro por aqui",
      // Resposta de uma palavra no lugar de pergunta aberta (copy v3).
      body: `{{nome}}, último e-mail, prometo.

Se o fechamento aí já cai no painel sem passar por planilha, ótimo, não insisto. Se ainda tem alguém extraindo do ERP e consolidando na mão todo mês, responde só "painel" ou "planilha" que eu te mando por escrito por onde eu começaria, sem reunião.

Se o assunto não for para vocês, me diz que eu não escrevo de novo.`,
    },
  ],
};
