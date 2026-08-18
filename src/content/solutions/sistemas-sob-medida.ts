import { contactUrl } from "@/config/site";
import type { Solution } from "@/content/types";

/** Copy conforme PRD §11.2, §20, §28, §47, §61. */
export const sistemasSobMedida: Solution = {
  slug: "sistemas-sob-medida",
  name: "Sistemas Sob Medida",
  order: "02",
  eyebrow: "Sistemas Sob Medida",
  headline: "Sua operação é única. Seu sistema também pode ser.",
  intro:
    "Quando o software existente exige que sua empresa mude demais para utilizá-lo, pode ser hora de construir a tecnologia em torno do negócio — e não o contrário.",
  description: "Criamos sistemas específicos para eliminar gargalos, centralizar informações e aumentar produtividade.",
  cardTitle: "Construa tecnologia em torno da sua operação.",
  cardCta: "Resolver operação",
  problem: {
    title: "Quando o software genérico vira o gargalo",
    intro:
      "Softwares genéricos obrigam empresas a adaptarem seus processos. Em determinadas operações, essa adaptação aumenta trabalho, gera planilhas paralelas, cria retrabalho, fragmenta dados e reduz produtividade.",
    items: [
      "Trabalho manual",
      "Dados espalhados",
      "Planilhas críticas",
      "Retrabalho",
      "Sistemas desconectados",
      "Informações difíceis de consultar",
      "Processo específico demais para software genérico",
    ],
  },
  message: {
    title: "Você não precisa chegar com a solução pronta.",
    paragraphs: [
      "Você conhece seu negócio. Nós conhecemos tecnologia.",
      "Começamos entendendo o processo e desenhamos juntos a solução necessária.",
    ],
  },
  examples: {
    title: "O que pode ser construído",
    intro:
      "A Dreamy desenvolve sistemas construídos especificamente em torno da operação. Não são pacotes independentes: cada sistema combina o que a operação exige.",
    items: [
      "Dashboards",
      "Sistemas internos",
      "CRMs",
      "Portais",
      "Ferramentas comerciais",
      "Gestão de processos",
      "Integrações",
    ],
  },
  process: {
    title: "Do problema à implantação",
    steps: [
      { label: "Problema" },
      { label: "Processo" },
      { label: "Arquitetura" },
      { label: "Experiência" },
      { label: "Desenvolvimento" },
      { label: "Integração" },
      { label: "Implantação" },
    ],
  },
  visual: {
    title: "Fluxo: dos dados à decisão",
    steps: [
      { label: "Dados", detail: "planilhas, sistemas, pessoas" },
      { label: "Sistema", detail: "construído em torno da operação" },
      { label: "Dashboard", detail: "informação consolidada" },
      { label: "Decisão", detail: "com visibilidade" },
    ],
  },
  cta: { label: "Resolver um gargalo", href: contactUrl("sistema") },
  contactParam: "sistema",
  seo: {
    title: "Desenvolvimento de Sistemas Sob Medida | Dreamy",
    description:
      "Sistemas personalizados construídos em torno da operação da sua empresa: sistemas internos, dashboards, CRMs, portais e integrações para eliminar gargalos e centralizar informações.",
  },
  keywords: [
    "desenvolvimento de software sob medida",
    "desenvolvimento de sistemas sob medida",
    "software personalizado",
    "empresa de desenvolvimento de sistemas",
    "sistema personalizado para empresas",
    "dashboard empresarial",
    "CRM personalizado",
    "software para processos internos",
  ],
};
