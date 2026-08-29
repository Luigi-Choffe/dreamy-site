import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA-MODELO — não é para envio real (industria: "exemplo", status: "draft").
 * Âncora: Agentes de IA. Para criar uma campanha real, copie este arquivo e siga
 * GUIA-COPY.md: troque o slug, a industria (valor normalizado da coluna indústria
 * da lista) e a cena do E1 pelo vocabulário do setor. O utm_campaign do link do E3 é
 * o slug da campanha, hardcoded — atualize junto com o slug.
 */

export const exemploAgentes: CampaignDefinition = {
  slug: "exemplo-agentes",
  industria: "exemplo",
  anchor: "agente-ia",
  status: "draft",
  notes:
    "Modelo para adaptar por indústria real (fit típico: indústria/manufatura e operações com muito trabalho repetitivo de informação). " +
    "Ângulo: agente executa etapas de processo com escopo e permissões — autonomia com controle, sempre nessa ordem. " +
    "Atenção: o lint de copy veta a palavra 'chatbot' até em negação ('não é chatbot') — diga 'robô de conversa' ou descreva o que o agente FAZ. " +
    "E3 cita um único dado de mercado com fonte (IDC/Microsoft), os únicos números permitidos (PRD outbound §6).",
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      subject: "o relatório montado à mão na {{empresa}}",
      body: `{{nome}}, em quase toda operação existe alguém que perde horas da semana montando o mesmo relatório: abre sistema, copia para a planilha, cruza com e-mail, confere, envia.

Hoje dá para um agente de IA assumir esse tipo de trabalho: ler os sistemas, consolidar e entregar o número pronto, dentro de regras e permissões que você define. Não estou falando de robô de conversa. É software que executa etapas de um processo real.

Na {{empresa}}, qual seria o primeiro relatório que você tiraria da mão de alguém?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "autonomia com controle, sempre nessa ordem",
      body: `{{nome}}, a reação mais comum quando o assunto é agente de IA: medo de perder o controle. Reação justa, aliás.

Por isso a ordem aqui é fixa: escopo definido, regras claras, permissões que você autoriza. O agente acessa só o que pode acessar, faz a parte repetitiva e passa a conversa para uma pessoa quando o assunto exige gente.

Você também não precisa chegar sabendo onde a IA entra. O diagnóstico serve para isso. E às vezes ele conclui que ainda não vale a pena automatizar nada. A gente fala quando é o caso.

Onde o time da {{empresa}} mais perde tempo com trabalho repetitivo hoje?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      withLink: true,
      subject: "quanto volta de cada dólar investido em ia",
      body: `{{nome}}, um dado de mercado, com a fonte junto: nas empresas que a IDC mediu com a Microsoft em 2024, cada dólar investido em IA generativa devolveu em média 3,7 dólares.

Na prática, esse retorno aparece quando a IA executa trabalho de verdade: atendimento, qualificação de leads, consolidação da operação. Não quando fica presa na demonstração.

Como a gente constrói isso está aqui: https://www.dreamy.app.br/solucoes/agentes-de-ia?solucao=agente-ia&utm_source=outbound&utm_medium=email&utm_campaign=exemplo-agentes&utm_content=e3

Se quiser um atalho: me conta um processo da {{empresa}} que toma tempo do time, e eu digo com franqueza se um agente ajudaria ou não.`,
    },
    {
      id: "e4",
      offsetDays: 7,
      subject: "paro por aqui",
      body: `{{nome}}, este é o último e-mail da minha parte.

Deixo uma régua simples: se alguém na {{empresa}} passa horas por semana em um trabalho que segue sempre as mesmas regras, provavelmente existe um agente capaz de assumir essa parte. Quando quiser testar a régua em um caso real, é só responder.

E se o assunto não fizer sentido para vocês, me diz que eu paro por aqui e não volto a escrever.`,
    },
  ],
};
