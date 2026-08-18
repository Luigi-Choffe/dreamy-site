import { contactUrl } from "@/config/site";
import type { Solution } from "@/content/types";

/** Copy conforme PRD §11.3, §20, §29, §47, §61. */
export const agentesDeIa: Solution = {
  slug: "agentes-de-ia",
  name: "Agentes de IA",
  order: "03",
  eyebrow: "Agentes de IA",
  headline: "Coloque a IA para executar trabalho dentro da sua empresa.",
  intro:
    "IA gera valor quando deixa de ser apenas uma conversa e passa a participar de processos reais. Criamos agentes conectados aos dados, sistemas e ferramentas da empresa.",
  description: "Criamos agentes conectados aos sistemas, dados e processos da empresa.",
  cardTitle: "Faça a IA executar trabalho real.",
  cardCta: "Aplicar IA",
  problem: {
    title: "Não é um chatbot. É software que executa etapas de um processo.",
    intro:
      "Um agente de IA é software capaz de interpretar informações, acessar ferramentas autorizadas e executar etapas de determinados processos — dentro de escopo, regras e permissões definidos pela empresa.",
    items: [
      "Interpreta informações",
      "Acessa ferramentas autorizadas",
      "Executa etapas de processos",
      "Registra e atualiza sistemas",
      "Encaminha para pessoas quando necessário",
    ],
  },
  useCases: [
    {
      id: "atendimento",
      title: "Atendimento",
      tasks: [
        "Responder",
        "Consultar informações",
        "Qualificar",
        "Registrar",
        "Encaminhar",
        "Atualizar CRM",
        "Agendar",
        "Apoiar o cliente",
      ],
      flow: {
        title: "Fluxo de atendimento com agente",
        steps: [
          { label: "Cliente" },
          { label: "Agente" },
          { label: "Informações" },
          { label: "CRM" },
          { label: "Humano quando necessário" },
        ],
      },
    },
    {
      id: "vendas",
      title: "Vendas",
      tasks: [
        "Pesquisar prospects",
        "Enriquecer informações",
        "Preparar vendedor",
        "Qualificar",
        "Criar follow-ups",
        "Priorizar leads",
        "Resumir oportunidades",
        "Atualizar CRM",
      ],
      flow: {
        title: "Fluxo comercial com agente",
        steps: [
          { label: "Lead" },
          { label: "Pesquisa" },
          { label: "Qualificação" },
          { label: "Priorização" },
          { label: "Follow-up" },
          { label: "Vendedor" },
        ],
      },
    },
    {
      id: "operacao",
      title: "Operação",
      tasks: [
        "Consultar documentos",
        "Consolidar informações",
        "Gerar relatórios",
        "Buscar dados",
        "Executar processos",
        "Utilizar sistemas internos",
        "Automatizar tarefas multi-etapas",
      ],
      flow: {
        title: "Fluxo operacional com agente",
        steps: [
          { label: "Sistemas + documentos + dados" },
          { label: "Agente" },
          { label: "Análise" },
          { label: "Ação" },
        ],
      },
    },
  ],
  principles: {
    title: "Autonomia não significa falta de controle.",
    intro: "Agentes devem operar com:",
    items: [
      "Escopo definido",
      "Permissões",
      "Regras",
      "Rastreabilidade quando aplicável",
      "Pontos de confirmação",
      "Handoff humano",
    ],
  },
  integrations: {
    title: "O valor aparece quando a IA conhece o contexto da empresa.",
    intro:
      "Um agente só executa trabalho útil quando está conectado às fontes de informação e às ferramentas que a operação já usa.",
    items: [],
    nodes: ["CRM", "ERP", "WhatsApp", "E-mail", "Banco de dados", "Documentos", "APIs"],
  },
  process: {
    title: "Do caso de uso ao agente em operação",
    steps: [
      { label: "Caso de uso" },
      { label: "Escopo e regras" },
      { label: "Integrações" },
      { label: "Desenvolvimento" },
      { label: "Validação" },
      { label: "Operação assistida" },
      { label: "Evolução" },
    ],
  },
  visual: {
    title: "Fluxo: do humano ao retorno",
    steps: [
      { label: "Humano", detail: "define o objetivo" },
      { label: "Agente", detail: "interpreta e decide" },
      { label: "Ferramentas", detail: "CRM, ERP, documentos" },
      { label: "Ação", detail: "executa a etapa" },
      { label: "Retorno", detail: "registra e informa" },
    ],
  },
  cta: { label: "Encontrar uma aplicação para IA", href: contactUrl("agente-ia") },
  contactParam: "agente-ia",
  seo: {
    title: "Agentes de IA para Empresas | Dreamy",
    description:
      "Agentes de IA conectados aos dados, sistemas e ferramentas da sua empresa para executar trabalho real em atendimento, vendas e operação — com escopo, permissões e handoff humano.",
  },
  keywords: [
    "agentes de IA para empresas",
    "agente de IA",
    "IA para atendimento",
    "IA para vendas",
    "IA integrada ao CRM",
    "IA para WhatsApp",
    "automação com IA",
  ],
};
