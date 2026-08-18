import type { FaqItem } from "@/content/types";

/** FAQ da Home — literal do PRD §25. */
export const faqItems: FaqItem[] = [
  {
    question: "Preciso saber exatamente qual sistema quero?",
    answer:
      "Não. Muitas vezes nossos clientes chegam com um problema, não com uma especificação. Começamos entendendo a operação e estruturamos a solução antes de iniciar o desenvolvimento.",
  },
  {
    question: "A Dreamy trabalha com softwares que minha empresa já utiliza?",
    answer:
      "Sim. Podemos desenvolver novos sistemas e integrá-los à estrutura existente quando houver mecanismos técnicos disponíveis.",
  },
  {
    question: "Vocês integram ERP, CRM e outras plataformas?",
    answer:
      "Sim, quando as plataformas oferecem APIs ou outros mecanismos compatíveis. A Dreamy desenvolve e mantém a camada de integração sob sua responsabilidade, mas disponibilidade e limitações técnicas de serviços externos dependem dos respectivos fornecedores.",
  },
  {
    question: "O que diferencia um agente de IA de um chatbot?",
    answer:
      "Um chatbot normalmente se concentra na conversa. Um agente pode ser desenvolvido para consultar informações, interagir com sistemas e executar etapas de processos definidos.",
  },
  {
    question: "A Dreamy trabalha somente com IA?",
    answer:
      "Não. IA é uma ferramenta. Em muitos casos, um sistema tradicional ou uma automação simples é uma solução melhor.",
  },
  {
    question: "Quanto tempo leva um projeto?",
    answer:
      "Depende do problema, escopo e integrações necessárias. Após o diagnóstico, estruturamos escopo, etapas e cronograma antes de iniciar o desenvolvimento.",
  },
  {
    question: "A Dreamy oferece manutenção?",
    answer:
      "Projetos podem incluir planos de manutenção e evolução após a entrada em produção, definidos conforme escopo e necessidade.",
  },
];
