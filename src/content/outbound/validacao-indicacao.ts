import type { CampaignDefinition } from "../../lib/outbound/types";

/**
 * CAMPANHA REAL — validação + indicação (lote Clay "Luigi_CONSTRUCAO", SP, 2026-08).
 * Alvo: a camada de gestão intermediária excluída por cargo-fora-icp. A auditoria
 * do GARIMPO (07/09) aprovou 20 dos 37, em DUAS ONDAS: 6 imediatos (empresas sem
 * decisor em sequência ativa; custom.reativacao "…onda-1", já inscritos) e 14
 * que entram quando a sequência do decisor da empresa encerrar (marcados
 * "aguardando-onda-2"; demanda na fila). Fora: 1 anomalia de domínio, 2 RH,
 * 4 controladoria, 10 por cap de 2 por empresa (reserva).
 *
 * OBJETIVO (ordem do Luigi): zero venda. Pedimos a quem vive a dor no dia a dia
 * (1) validar se a dor é real na empresa dele e (2) apontar o sócio/diretor que
 * decide esse assunto. Tom: respeito pela expertise, humildade de quem pergunta.
 *
 * Formato "campanha de CONVERSA" — foge do PRD §7 de propósito: 3 passos (não 4),
 * cadência 0/+3/+7 e NENHUM link (conversa, não tráfego). Exceção registrada por
 * slug em tests/unit/outbound-campaigns.test.ts (CONVERSATION_CAMPAIGNS, 07/09);
 * as demais campanhas seguem sob a regra cheia.
 *
 * {{abertura}} vem do enriquecimento (uma linha após "{{nome}}, ", minúscula,
 * termina em ponto). Motor bloqueia envio se faltar.
 *
 * Aprovada pelo Luigi em 2026-09-09 ("ta aprovado segue"); approve registrado
 * via CLI em 2026-09-10 (outbound:campaign approve — ADR-020).
 */

export const validacaoIndicacao: CampaignDefinition = {
  slug: "validacao-indicacao",
  // Default: o maior segmento do alvo. O enroll roda com override por indústria
  // (serviços de engenharia, incorporadora, fornecedor usam a mesma copy).
  industria: "construção obras para terceiros",
  // Âncora mais neutra do enum (sistemas/operação); nenhum passo vende ou linka.
  anchor: "sistema",
  // "ready" + aprovação do Luigi registrada em 2026-09-09/10 ("ta aprovado segue").
  status: "ready",
  notes:
    "Lote Clay construção SP 2026-08 — 37 contatos hoje excluded (cargo-fora-icp): camada de gerência/coordenação/supervisão. " +
    "Objetivo 100% validação + indicação, zero pitch: e1 valida a dor operacional universal (planilha, retrabalho campo/escritório, " +
    "informação que chega tarde), e2 pede indicação explícita do decisor, e3 encerra com porta aberta. " +
    "SEM link em nenhum passo; 3 passos 0/+3/+7 (formato conversa, exceção registrada no teste estrutural por slug).",
  sampleCustom: {
    abertura: "vi que vocês executam obras para grandes contratantes em São Paulo. Você vive essa operação por dentro.",
  },
  steps: [
    {
      id: "e1",
      offsetDays: 0,
      subject: "{{empresa}} e o número que chega tarde",
      body: `{{nome}}, {{abertura}}

Escrevo para testar uma leitura com quem vive a operação, não com quem só vê o número no fim do mês. A cena que escuto se repete: a informação nasce no campo, passa por planilha e chega ao escritório tarde e diferente do que aconteceu. Alguém refaz tudo na mão para fechar a semana.

Não quero te vender nada neste e-mail. Quero saber se essa leitura é real ou teoria minha.

É assim aí dentro também, e hoje quem segura essa ponta?`,
    },
    {
      id: "e2",
      offsetDays: 3,
      subject: "a pessoa certa para essa conversa",
      body: `{{nome}}, prometi não me alongar.

Outra cena que escuto sempre: o retrabalho entre o campo e o escritório. Um aponta de um jeito, o outro lança de outro, e no fechamento alguém gasta dois dias caçando uma diferença que não deveria existir.

Eu construo software sob medida para operações assim, mas essa decisão é de sócio ou diretor, e eu não quero tomar mais o seu tempo. Me aponta quem decide isso aí dentro, que eu paro de te interromper?`,
    },
    {
      id: "e3",
      offsetDays: 7,
      subject: "encerro por aqui",
      body: `{{nome}}, último e-mail, prometo.

Se as cenas que descrevi não acontecem aí, melhor ainda: vocês estão na frente da maioria que eu conheço. Se acontecem, a porta fica aberta, sem pressa nenhuma. Basta responder aqui, ou encaminhar esta conversa para o sócio ou diretor que cuida disso.

Fica só a pergunta que eu faria num café: o que vocês ainda fecham na mão toda semana?

E se o assunto não for para vocês, me diz que eu não escrevo de novo.`,
    },
  ],
};
