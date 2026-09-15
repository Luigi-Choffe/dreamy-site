import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA REAL — construção/obras para terceiros (lote Clay "Luigi_CONSTRUCAO", SP, 2026-08).
 * Âncora: Sistemas Sob Medida. Tese: quem constrói para terceiros vive da margem
 * por obra, e essa margem escapa na camada entre o canteiro e o escritório que o
 * ERP não cobre: medição em planilha, diário de obra no WhatsApp, custo real que
 * só aparece no fechamento do mês.
 *
 * {{abertura}} vem do enriquecimento por empresa (uma linha escrita da descrição
 * real; funciona após "{{nome}}, ", minúscula, termina em ponto). Motor bloqueia
 * envio se faltar.
 *
 * Aprovada pelo Luigi em 2026-09-01 ("Pode seguir! Está aprovado!") — registro
 * formal via outbound:campaign approve (ADR-020).
 */

export const obrasSistemasSobMedida: CampaignDefinition = {
  slug: "obras-sistemas-sob-medida",
  // Segmento curado da tabela de empresas (apply-segmentos): construtoras que
  // executam obra para terceiros (17 contatos ativos). Incorporadoras têm a
  // campanha própria (construcao-nova-receita); fornecedores ficam de fora.
  industria: "construção obras para terceiros",
  anchor: "sistema",
  status: "ready",
  notes:
    "Lote Clay construção SP 2026-08, segmento obras para terceiros (17 contatos). " +
    "Dor traduzida: custo real da obra só no fechamento; medição/aditivo/suprimento em planilha; " +
    "ERP fecha contabilidade mas não acompanha o canteiro. Copy v3 (14/09): E3 com o case do galpão como prova cruzada, E4 com resposta de uma palavra.",
  sampleCustom: {
    abertura:
      "vi que vocês executam obras corporativas e industriais para grandes contratantes em São Paulo. Cada boletim de medição fecha um mês inteiro de canteiro.",
  },
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      subject: "{{empresa}} entre o canteiro e o escritório",
      body: `{{nome}}, {{abertura}}

Escrevo porque vejo o mesmo padrão em construtora que toca obra de terceiro: o custo real da obra só aparece no fechamento do mês. A medição vive numa planilha que uma pessoa só entende, o diário de obra está no grupo de WhatsApp, e o escritório fecha com o número que a obra mandou, não com o que aconteceu no canteiro.

Meu trabalho é construir software sob medida em cima da operação de vocês, do canteiro ao faturamento.

Vale vinte minutos de conversa sobre onde a planilha aperta primeiro aí?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "o que o sistema de vocês não enxerga",
      body: `{{nome}}, complemento rápido ao que te mandei.

A objeção que mais escuto é essa: "a gente já tem ERP". O ERP fecha a contabilidade. Ele não acompanha medição, aditivo e suprimento no ritmo do canteiro. Essa camada entre a obra e o escritório é onde a margem escapa, e é ela que a gente constrói sob medida, encaixada no que vocês já usam.

O desenho da solução é trabalho nosso, feito junto com vocês. E quando a conta não fecha, eu sou o primeiro a dizer que não vale construir nada.

Qual relatório vocês ainda montam na mão toda semana?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      // Copy v3 (aprovada pelo Luigi em 2026-09-14): sai a estatística de IA, fora do
      // tema; entra o case real do galpão como prova cruzada, sem nome do cliente.
      subject: "um caso meu fora da construção",
      body: `{{nome}}, te conto um caso meu, sem citar o nome.

Um cliente meu opera galpão em São Paulo. Os clientes dele ligavam para saber do estoque e pediam retirada por WhatsApp. Construímos um sistema sob medida em cima dessa rotina e hoje eles fazem tudo por um app. Ninguém planejou, mas passaram a pagar por ele: mais de 50 empresas usam, e o app gera mais receita que o próprio serviço de logística.

Escrevi como pensamos isso: https://www.dreamy.app.br/solucoes/sistemas-sob-medida?solucao=sistema&utm_source=outbound&utm_medium=email&utm_campaign=obras-sistemas-sob-medida&utm_content=e3

Por aí, o contratante ainda cobra andamento e medição por WhatsApp?`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "encerro por aqui",
      // Copy v3: resposta de uma palavra no lugar da pergunta aberta.
      body: `{{nome}}, último e-mail, prometo.

Se medição e custo de obra já fecham em dia aí, ótimo, não insisto. Se ainda dependem da planilha e do fechamento do mês, responde só "planilha" que eu te mando por escrito por onde eu começaria, sem reunião.

Se o assunto não for para vocês, me diz que eu não escrevo de novo.`,
    },
  ],
};
