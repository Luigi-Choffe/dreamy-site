import { routes } from "@/config/site";
import type { FlowContent, ProcessStep } from "@/content/types";

/**
 * Copy da Home — literal do PRD (§15, §19–§26). Não alterar sem revisar o PRD.
 */
export const homeContent = {
  hero: {
    eyebrow: "Software sob medida + Inteligência Artificial",
    title: "Tecnologia sob medida para sua empresa ganhar mais e operar melhor.",
    text: "Criamos novos produtos digitais, sistemas personalizados e agentes de IA para desafios que softwares prontos não resolvem.",
    primaryCta: { label: "Conversar sobre meu negócio", href: routes.contact },
    secondaryCta: { label: "Conhecer as soluções", href: routes.solutions },
    microcopy: "Começamos pelo problema. A tecnologia vem depois.",
    /** Visual próprio (PRD §16): empresa conectando dados, clientes, sistemas, operação, IA e receita. */
    visual: {
      title: "Diagrama abstrato: a empresa no centro, conectada a clientes, dados, sistemas, operação, IA e receita.",
      center: "Sua empresa",
      nodes: ["Clientes", "Dados", "Sistemas", "Operação", "IA", "Receita"],
    },
  },

  proof: {
    title: "Tecnologia que já está em operação.",
  },

  problem: {
    title: "Nem todo problema da sua empresa cabe em um software pronto.",
    lines: [
      "Sua empresa cresce.",
      "Os processos ficam mais específicos.",
      "Sistemas deixam de conversar.",
      "Planilhas passam a sustentar decisões importantes.",
      "Informações dependem de pessoas.",
      "Leads deixam de receber acompanhamento.",
    ],
    closing:
      "E oportunidades que poderiam virar receita ficam paradas porque a tecnologia disponível não acompanha o negócio.",
    punchline: "É nesse ponto que entramos.",
  },

  solutions: {
    title: "Três formas de transformar tecnologia em resultado.",
  },

  diagnosis: {
    title: "Você não precisa saber o que construir.",
    paragraphs: [
      "Normalmente, nossos clientes chegam com uma dor. Não com uma especificação técnica.",
      "Eles sabem que determinada atividade demora demais. Que uma oportunidade comercial está sendo desperdiçada. Que informações estão espalhadas. Ou que alguma parte da operação não escala.",
      "Nosso trabalho começa identificando qual tecnologia faz sentido construir — se fizer sentido construir alguma.",
    ],
    flow: {
      title: "Fluxo do diagnóstico: da dor ao resultado",
      steps: [
        { label: "Dor" },
        { label: "Impacto" },
        { label: "Oportunidade" },
        { label: "Solução" },
        { label: "Tecnologia" },
        { label: "Resultado" },
      ],
    } satisfies FlowContent,
  },

  cases: {
    title: "Problemas reais. Tecnologia em produção.",
    cta: "Ver case",
  },

  process: {
    id: "como-trabalhamos",
    eyebrow: "Como trabalhamos",
    title: "Da dor ao software.",
    steps: [
      { number: "01", title: "Entender", description: "Mapeamos problema, impacto e contexto." },
      {
        number: "02",
        title: "Desenhar",
        description: "Definimos solução, experiência, arquitetura e integrações.",
      },
      {
        number: "03",
        title: "Construir",
        description: "Desenvolvemos em ciclos curtos e validamos continuamente.",
      },
      {
        number: "04",
        title: "Colocar para trabalhar",
        description: "Implantamos a solução na operação real.",
      },
      {
        number: "05",
        title: "Evoluir",
        description: "Acompanhamos uso, resultados e novas oportunidades.",
      },
    ] satisfies ProcessStep[],
  },

  fit: {
    title: "Para empresas que já têm operação — e querem chegar ao próximo nível.",
    items: [
      "Processos que não escalam",
      "Sistemas desconectados",
      "Base relevante de clientes",
      "Equipe comercial",
      "Dados espalhados",
      "Oportunidades digitais ainda não exploradas",
    ],
    closing:
      "Se a empresa já funciona, mas a tecnologia começou a limitar seu crescimento, provavelmente existe algo que podemos construir.",
  },

  faq: {
    title: "Perguntas frequentes",
  },

  finalCta: {
    title: "Qual problema da sua empresa valeria a pena resolver agora?",
    text: "Conte o contexto. Vamos entender a oportunidade e avaliar se existe uma solução tecnológica capaz de gerar impacto relevante.",
    cta: { label: "Conversar com a Dreamy", href: routes.contact },
    microcopy: "Sem apresentação genérica. Vamos falar sobre o seu negócio.",
  },
} as const;
