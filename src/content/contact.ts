import { routes } from "@/config/site";

/** Página /contato e formulário — PRD §34–§39. */
export const contactContent = {
  eyebrow: "Contato",
  title: "Vamos entender o que vale a pena construir.",
  intro:
    "Conte o contexto da sua empresa. Não é preciso chegar com uma especificação técnica: começamos pelo problema ou pela oportunidade.",
  aside: {
    title: "O que acontece depois",
    items: [
      "Lemos o contexto que você enviou.",
      "Avaliamos se existe uma solução tecnológica capaz de gerar impacto relevante.",
      "Entramos em contato para combinar o próximo passo.",
    ],
    whatsappLabel: "Prefere WhatsApp?",
    whatsappCta: "Falar pelo WhatsApp",
  },
  steps: {
    labels: ["Sobre você", "Sobre o desafio"],
    next: "Continuar",
    back: "Voltar",
    submit: "Enviar contexto",
    submitting: "Enviando…",
  },
  fields: {
    name: { label: "Nome", placeholder: "Seu nome" },
    company: { label: "Empresa", placeholder: "Nome da empresa" },
    role: { label: "Cargo", placeholder: "Ex.: Sócio, CEO, Diretor de Operações" },
    email: { label: "E-mail", placeholder: "voce@empresa.com.br", hint: "Preferencialmente o e-mail profissional." },
    phone: { label: "WhatsApp / telefone", placeholder: "(11) 99999-9999" },
    need: {
      label: "Qual situação descreve melhor o que você procura?",
      options: [
        { value: "nova-receita", label: "Quero criar uma nova fonte de receita" },
        { value: "sistema", label: "Preciso desenvolver um sistema" },
        { value: "agente-ia", label: "Quero aplicar IA na empresa" },
        { value: "nao-sei", label: "Tenho uma dor, mas ainda não sei qual solução preciso" },
        { value: "outro", label: "Outro" },
      ],
    },
    description: {
      label: "Qual problema ou oportunidade você quer resolver?",
      placeholder: "Descreva o contexto: o que acontece hoje, o que trava, o que você gostaria que fosse diferente.",
    },
    urgency: {
      label: "Quão urgente é isso?",
      options: [
        { value: "agora", label: "Agora" },
        { value: "30-dias", label: "Próximos 30 dias" },
        { value: "1-3-meses", label: "1–3 meses" },
        { value: "3-6-meses", label: "3–6 meses" },
        { value: "pesquisando", label: "Apenas pesquisando" },
      ],
    },
    investment: {
      label: "Existe uma faixa de investimento prevista?",
      hint: "Opcional. Ajuda a calibrar o tipo de solução.",
      options: [
        { value: "ate-20k", label: "Até R$ 20 mil" },
        { value: "20-50k", label: "R$ 20–50 mil" },
        { value: "50-100k", label: "R$ 50–100 mil" },
        { value: "100-250k", label: "R$ 100–250 mil" },
        { value: "250k-mais", label: "Acima de R$ 250 mil" },
        { value: "indefinido", label: "Ainda não definimos" },
      ],
    },
    consent: {
      label: "Li e concordo com a",
      linkLabel: "Política de Privacidade",
      href: routes.privacy,
      after: ". Os dados enviados são usados apenas para retorno comercial.",
    },
  },
  errors: {
    required: "Campo obrigatório.",
    name: "Informe seu nome.",
    company: "Informe o nome da empresa.",
    role: "Informe seu cargo.",
    email: "Informe um e-mail válido.",
    phone: "Informe um telefone válido com DDD.",
    need: "Selecione a opção que melhor descreve sua situação.",
    description: "Descreva o problema ou a oportunidade (mínimo de 20 caracteres).",
    descriptionMax: "O texto ultrapassou o limite de 3.000 caracteres.",
    urgency: "Selecione uma opção.",
    consent: "É necessário concordar com a política de privacidade.",
    server: "Não conseguimos registrar seu contato agora. Seus dados foram mantidos — tente novamente em instantes.",
    network: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    rateLimit: "Recebemos muitas tentativas deste dispositivo. Aguarde alguns minutos e tente novamente.",
    retry: "Tentar novamente",
  },
  success: {
    title: "Recebemos seu contexto.",
    text: "Vamos analisar o que você enviou e entrar em contato para avaliar o próximo passo.",
    bookingTitle: "Quer adiantar a conversa? Escolha um horário.",
    bookingCta: "Escolher horário",
    backHome: "Voltar para o início",
    solutionsCta: "Conhecer as soluções",
  },
  seo: {
    title: "Contato | Dreamy — Vamos entender o que vale a pena construir",
    description:
      "Conte o contexto da sua empresa. Vamos entender a oportunidade e avaliar se existe uma solução tecnológica capaz de gerar impacto relevante.",
  },
} as const;
