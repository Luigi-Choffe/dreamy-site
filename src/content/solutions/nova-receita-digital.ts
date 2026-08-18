import { contactUrl } from "@/config/site";
import type { Solution } from "@/content/types";

/** Copy conforme PRD §11.1, §20, §27, §47, §61. */
export const novaReceitaDigital: Solution = {
  slug: "nova-receita-digital",
  name: "Nova Receita Digital",
  order: "01",
  eyebrow: "Nova Receita Digital",
  headline: "Transforme sua base de clientes em uma nova fonte de receita.",
  intro:
    "Sua empresa já conquistou clientes, conhecimento, distribuição e confiança. A próxima oportunidade pode estar em transformar parte disso em um produto digital que os clientes também estejam dispostos a comprar.",
  description: "Transformamos oportunidades dentro da base e do conhecimento da empresa em novos produtos digitais.",
  cardTitle: "Crie o próximo produto que seus clientes podem comprar.",
  cardCta: "Explorar oportunidade",
  problem: {
    title: "Você talvez já tenha o ativo. Falta transformá-lo em produto.",
    intro:
      "Empresas frequentemente já possuem clientes, conhecimento, dados, processos, relacionamento, autoridade e distribuição — mas monetizam isso apenas através do produto principal. A Dreamy identifica oportunidades de transformar esses ativos em um produto digital.",
    items: ["Conhecimento", "Processo", "Dados", "Serviço", "Distribuição", "Comunidade", "Relacionamento"],
  },
  solution: {
    title: "Da oportunidade ao produto em produção.",
    intro: "A Dreamy atua em todas as etapas:",
    items: [
      "Entendimento",
      "Oportunidade",
      "Modelo",
      "Experiência",
      "Software",
      "Integrações",
      "Lançamento",
      "Evolução",
    ],
  },
  examples: {
    title: "Formatos possíveis",
    intro: "Os exemplos servem para entendimento — cada produto nasce da oportunidade específica da empresa.",
    items: ["SaaS", "Portal", "Plataforma", "Assinatura", "Ferramenta complementar", "Produto B2B"],
  },
  highlight:
    "Se apenas uma parte dos seus clientes pagasse por um novo produto digital, o que valeria a pena construir?",
  process: {
    title: "Da oportunidade à evolução",
    steps: [
      { label: "Oportunidade" },
      { label: "Validação" },
      { label: "Modelo de negócio" },
      { label: "Produto" },
      { label: "Desenvolvimento" },
      { label: "Lançamento" },
      { label: "Evolução" },
    ],
  },
  visual: {
    title: "Fluxo: da base atual à receita recorrente",
    steps: [
      { label: "Base atual", detail: "clientes, conhecimento, dados" },
      { label: "Produto", detail: "novo produto digital" },
      { label: "Assinatura", detail: "modelo de cobrança" },
      { label: "Receita recorrente", detail: "nova linha de receita" },
    ],
  },
  cta: { label: "Explorar uma oportunidade", href: contactUrl("nova-receita") },
  contactParam: "nova-receita",
  seo: {
    title: "Desenvolvimento de Produtos Digitais e SaaS | Dreamy",
    description:
      "Transforme sua base de clientes em uma nova fonte de receita. A Dreamy desenvolve produtos digitais, SaaS e plataformas B2B a partir dos ativos que sua empresa já possui.",
  },
  keywords: [
    "desenvolvimento de produto digital",
    "criação de SaaS",
    "produto digital B2B",
    "monetização de base de clientes",
  ],
};
