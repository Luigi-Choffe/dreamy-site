import { routes } from "@/config/site";

/** Página Sobre — PRD §32. Descrições dos princípios são copy autoral (docs/COPY-REVIEW.md). */
export const aboutContent = {
  eyebrow: "Sobre a Dreamy",
  title: "Construímos tecnologia quando a solução pronta não basta.",
  paragraphs: [
    "A Dreamy é uma empresa de desenvolvimento de software e inteligência artificial.",
    "Trabalhamos com empresas que possuem problemas específicos, processos próprios ou oportunidades que exigem tecnologia construída em torno do negócio.",
    "Não começamos escolhendo ferramenta. Começamos entendendo o problema.",
  ],
  principlesTitle: "Princípios",
  principles: [
    {
      title: "Negócio antes da tecnologia",
      description:
        "Toda conversa começa pelo problema, pelo impacto e pelo contexto da operação. A escolha da tecnologia é consequência, não ponto de partida.",
    },
    {
      title: "Simplicidade antes da complexidade",
      description:
        "Preferimos a solução mais simples que resolve o problema. Complexidade só entra quando gera resultado proporcional.",
    },
    {
      title: "Software deve gerar consequência",
      description:
        "Um sistema só faz sentido quando muda algo na operação: menos trabalho manual, mais visibilidade, mais capacidade ou nova receita.",
    },
    {
      title: "IA precisa executar algo útil",
      description:
        "Não construímos IA para demonstração. Agentes existem para executar etapas de processos reais, com escopo, permissões e supervisão.",
    },
    {
      title: "Produto continua evoluindo depois do lançamento",
      description: "A entrada em produção é o começo. Acompanhamos uso e resultados para evoluir o que foi construído.",
    },
  ],
  howWeWork: {
    title: "Como trabalhamos",
    text: "O caminho é sempre o mesmo: entender, desenhar, construir, colocar para trabalhar e evoluir.",
    cta: { label: "Ver o processo completo", href: routes.howWeWork },
  },
  cta: {
    title: "Existe um problema na sua empresa que a tecnologia pronta não resolve?",
    text: "Conte o contexto. Vamos avaliar juntos se vale a pena construir algo.",
    label: "Conversar com a Dreamy",
    href: routes.contact,
  },
  seo: {
    title: "Sobre a Dreamy | Software sob medida e IA para empresas",
    description:
      "A Dreamy é uma empresa de desenvolvimento de software e inteligência artificial que constrói tecnologia em torno do negócio quando a solução pronta não basta.",
  },
};
