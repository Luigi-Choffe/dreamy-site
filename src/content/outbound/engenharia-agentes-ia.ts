import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA REAL — construção/serviços de engenharia (lote Clay "Luigi_CONSTRUCAO", SP, 2026-08).
 * Âncora: Agentes de IA. Tese: a hora mais cara do escritório de engenharia vai
 * para tarefa que não é engenharia (relatório, conferência de documento, caça à
 * última versão). Agente prepara; análise e assinatura continuam com o engenheiro
 * (gate humano é o argumento, não a ressalva).
 *
 * Aprovada pelo Luigi em 2026-09-01 ("Pode seguir! Está aprovado!") — registro
 * formal via outbound:campaign approve (ADR-020).
 */

export const engenhariaAgentesIa: CampaignDefinition = {
  slug: "engenharia-agentes-ia",
  // Segmento curado (apply-segmentos): serviços de engenharia (6 contatos ativos) —
  // gerenciamento, fiscalização, projetos e consultorias.
  industria: "construção serviços de engenharia",
  anchor: "agente-ia",
  status: "ready",
  notes:
    "Lote Clay construção SP 2026-08, segmento serviços de engenharia (6 contatos). " +
    "Dor traduzida: horas técnicas caras em tarefa administrativa; papelada em volta do projeto. " +
    "Objeção central respondida no E2: trabalho técnico não tolera erro (agente prepara, engenheiro assina). " +
    "E3 usa dado de mercado com fonte (McKinsey), sem simulação.",
  sampleCustom: {
    abertura:
      "vi que vocês fazem gerenciamento e fiscalização de obras para incorporadoras em São Paulo. Cada visita de obra termina em relatório.",
  },
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      subject: "as horas técnicas da {{empresa}}",
      body: `{{nome}}, {{abertura}}

Escrevo porque vejo o mesmo padrão em empresa de engenharia: a hora mais cara do escritório indo para tarefa que não é engenharia. Engenheiro sênior montando relatório, conferindo documento, caçando a última versão do projeto no e-mail.

Meu trabalho é criar agentes de IA sob medida para essa camada: eles leem o documento, organizam a informação e preparam o rascunho. A análise e a assinatura continuam com o engenheiro.

Vale vinte minutos de conversa sobre onde o tempo técnico escorre aí?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "engenharia não tolera erro",
      body: `{{nome}}, complemento rápido ao que te mandei.

A objeção que mais escuto é essa: "trabalho técnico não tolera erro de IA". Concordo. Por isso agente nosso não assina nada: ele prepara, o engenheiro revisa e decide. E começamos sempre pelo processo de maior volume e menor risco, onde conferir é rápido e o tempo ganho aparece na primeira semana.

O desenho é trabalho nosso, feito junto com vocês. Quando não vale automatizar, eu sou o primeiro a dizer.

Qual tarefa repetitiva mais consome as horas técnicas de vocês hoje?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      subject: "a papelada em volta do projeto",
      body: `{{nome}}, um dado de mercado, com a fonte junto: 88% das empresas já usam IA em pelo menos uma função, ante 78% um ano antes (McKinsey, State of AI 2025).

A pergunta que interessa não é "se", é "onde". Em engenharia, o onde costuma ser a papelada em volta do projeto: relatório de visita, compatibilização de documento, resposta a edital.

Escrevi como pensamos agentes de IA: https://www.dreamy.app.br/solucoes/agentes-de-ia?solucao=agente-ia&utm_source=outbound&utm_medium=email&utm_campaign=engenharia-agentes-ia&utm_content=e3

Se preferir, responde que eu te mostro na operação de vocês.`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "encerro por aqui",
      body: `{{nome}}, este é o último, prometo.

Fica a pergunta que abre as melhores conversas com escritório de engenharia: quantas horas técnicas da {{empresa}} vão hoje para tarefa que uma boa ferramenta prepararia sozinha? Quando quiser fazer essa conta, é só responder aqui.

Se o assunto não for para vocês, me diz que eu paro por aqui.`,
    },
  ],
};
