import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA REAL — variante GENÉRICA da controladoria (decisão do Luigi, 2026-10-13).
 * Mesma lista Clay (controladoria SP 2026-10), mesma âncora (Sistemas Sob Medida) e
 * mesmo ângulo ("foco nos dashs") da campanha-mãe `controladoria-sistemas-sob-medida`.
 *
 * PARA QUEM: a onda 2 (95 pessoas SEM o "Sobre" do LinkedIn, logo sem abertura nem
 * gancho personalizados) e os contatos cujo cadastro de empresa está duvidoso.
 * Por isso esta variante NÃO cita o nome da empresa em lugar nenhum: nem no assunto,
 * nem no corpo, nem em frase de colegas.
 *
 * O QUE MUDA: só o E1. Sem {{empresa}}, {{abertura}}, {{gancho}} ou {{frase_colegas}};
 * a única variável é {{nome}}. A cena é a mesma da campanha-mãe (dado no ERP desde o
 * dia primeiro, painel montado na mão todo mês, diretoria pergunta antes de o painel
 * atualizar), escrita em primeira pessoa, sem fatos sobre a pessoa. E2, E3 e E4 são os
 * MESMOS textos da campanha-mãe; no E3 só troca o utm_campaign (= este slug) e no E4 a
 * resposta de uma palavra aceita "painel" ou "planilha" (a campanha-mãe recebe a mesma
 * frase).
 *
 * PROVA (E3): o case do galpão SEM nome (prova cruzada aprovada em 2026-09-14).
 * NUNCA valores em R$, NUNCA nome, NUNCA link do produto.
 *
 * Status "draft" até o Luigi aprovar (outbound:campaign approve — ADR-020).
 */

export const controladoriaPainelPlanilha: CampaignDefinition = {
  slug: "controladoria-painel-planilha",
  titulo: "Controladoria (geral)",
  industria: "controladoria",
  anchor: "sistema",
  status: "ready",
  notes:
    "Variante genérica da campanha de controladoria (onda 2: 95 contatos sem 'Sobre' do LinkedIn + cadastros de empresa duvidosos). " +
    "Não cita o nome da empresa em lugar nenhum. E1 sem slots de personalização (só {{nome}}), mesma cena do painel montado na mão; " +
    "E2, E3 e E4 idênticos à campanha-mãe (E3 com utm_campaign deste slug; E4 aceita 'painel' ou 'planilha' como resposta).",
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      // Sem nome de empresa no assunto (cadastro duvidoso / sem personalização).
      // Só a cena do setor. Sem link, sem número.
      subject: "o painel que ainda nasce na planilha",
      body: `{{nome}}, uma cena que se repete nas controladorias com quem converso.

O dado está no ERP desde o dia primeiro. Mesmo assim, o painel que a diretoria olha é montado na mão: alguém extrai, consolida na planilha e confere linha por linha antes de atualizar. Quando a diretoria pergunta como fechou o mês, a resposta ainda está sendo montada.

Eu construo software sob medida em cima da operação, para o número sair do ERP direto no painel, sem passar pela planilha.

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

Escrevi como pensamos isso: https://www.dreamy.app.br/solucoes/sistemas-sob-medida?solucao=sistema&utm_source=outbound&utm_medium=email&utm_campaign=controladoria-painel-planilha&utm_content=e3

Quantos dias depois do fechamento a diretoria vê o número aí?`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "encerro por aqui",
      // Resposta de uma palavra no lugar de pergunta aberta (copy v3). Aceita as
      // duas palavras, decisão do Luigi em 2026-10-13.
      body: `{{nome}}, último e-mail, prometo.

Se o fechamento aí já cai no painel sem passar por planilha, ótimo, não insisto. Se ainda tem alguém extraindo do ERP e consolidando na mão todo mês, responde só "painel" ou "planilha" que eu te mando por escrito por onde eu começaria, sem reunião.

Se o assunto não for para vocês, me diz que eu não escrevo de novo.`,
    },
  ],
};
