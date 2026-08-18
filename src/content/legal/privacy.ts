import { routes, siteConfig } from "@/config/site";

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDocument {
  title: string;
  updatedAt: string; // ISO date
  intro: string;
  sections: LegalSection[];
  seo: { title: string; description: string };
}

/**
 * Política de Privacidade (LGPD) — rascunho estruturado para validação jurídica
 * (PRD §73–§74: "Política final deverá ser validada conforme orientação jurídica").
 * Dados do controlador vêm de src/config/site.ts e são omitidos quando não configurados.
 */
export function getPrivacyPolicy(): LegalDocument {
  const controller = siteConfig.legalName
    ? `${siteConfig.legalName}${siteConfig.cnpj ? `, inscrita no CNPJ sob o nº ${siteConfig.cnpj}` : ""}`
    : "a Dreamy";
  const contactChannel = siteConfig.contact.email
    ? `pelo e-mail ${siteConfig.contact.email}`
    : `pelos canais indicados na página de contato (${siteConfig.url}${routes.contact})`;

  return {
    title: "Política de Privacidade",
    updatedAt: "2026-08-17",
    intro: `Esta política descreve como ${controller} ("Dreamy", "nós") trata os dados pessoais coletados por meio do site ${siteConfig.url}, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).`,
    sections: [
      {
        title: "1. Quais dados coletamos",
        paragraphs: [
          "Coletamos apenas os dados necessários para atender ao seu contato comercial e para operar o site.",
        ],
        items: [
          "Dados informados no formulário de contato: nome, empresa, cargo, e-mail, telefone/WhatsApp, situação que descreve o que você procura, descrição do problema ou oportunidade, urgência e, opcionalmente, faixa de investimento prevista.",
          "Dados de navegação e atribuição: página de entrada, página de origem (referrer) e parâmetros de campanha (UTM), quando presentes na URL, para entendermos como você chegou até nós.",
          "Dados de uso do site coletados por ferramentas de análise e marketing, somente com o seu consentimento (ver Política de Cookies).",
        ],
      },
      {
        title: "2. Para que usamos os dados",
        items: [
          "Responder ao seu contato e avaliar a possibilidade de uma conversa comercial (execução de procedimentos preliminares a contrato — art. 7º, V, LGPD).",
          "Organizar e priorizar internamente os contatos recebidos (legítimo interesse — art. 7º, IX, LGPD).",
          "Medir o desempenho do site e de campanhas, quando você consentir com cookies de análise e marketing (consentimento — art. 7º, I, LGPD).",
          "Garantir a segurança do site e prevenir abuso (legítimo interesse).",
        ],
      },
      {
        title: "3. Com quem compartilhamos",
        paragraphs: [
          "Os dados do formulário são tratados pela Dreamy e por fornecedores que operam em nosso nome, como plataforma de gestão de relacionamento (CRM), serviço de envio de e-mail e provedor de hospedagem. Esses fornecedores só podem usar os dados para prestar o serviço contratado.",
          "Dados pessoais informados no formulário (nome, e-mail, telefone, texto do problema) não são enviados a ferramentas de análise ou publicidade.",
          "Alguns fornecedores podem estar localizados fora do Brasil; nesses casos, adotamos as salvaguardas previstas na LGPD para transferência internacional.",
        ],
      },
      {
        title: "4. Por quanto tempo guardamos",
        paragraphs: [
          "Mantemos os dados do contato pelo tempo necessário para o atendimento comercial e por prazos exigidos por lei ou para exercício regular de direitos. Dados de análise seguem os prazos de retenção das respectivas ferramentas, descritos na Política de Cookies.",
        ],
      },
      {
        title: "5. Seus direitos",
        paragraphs: [
          "Você pode, a qualquer momento, solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento e revogação do consentimento, nos termos do art. 18 da LGPD.",
          `Para exercer seus direitos, fale conosco ${contactChannel}.`,
        ],
      },
      {
        title: "6. Segurança",
        paragraphs: [
          "Adotamos medidas técnicas e organizacionais para proteger os dados contra acessos não autorizados, perda ou alteração, como conexões criptografadas (HTTPS), controle de acesso e limitação da coleta ao necessário.",
        ],
      },
      {
        title: "7. Cookies",
        paragraphs: [
          `O uso de cookies e tecnologias semelhantes é detalhado na Política de Cookies (${siteConfig.url}${routes.cookies}). Você pode gerenciar suas preferências a qualquer momento pelo link "Preferências de cookies" no rodapé do site.`,
        ],
      },
      {
        title: "8. Alterações desta política",
        paragraphs: [
          "Esta política pode ser atualizada para refletir mudanças legais ou operacionais. A data da última atualização é indicada no topo da página.",
        ],
      },
      {
        title: "9. Contato",
        paragraphs: [
          `Dúvidas sobre esta política ou sobre o tratamento de dados pessoais podem ser enviadas ${contactChannel}.`,
        ],
      },
    ],
    seo: {
      title: "Política de Privacidade | Dreamy",
      description: "Como a Dreamy coleta, usa e protege dados pessoais no site, em conformidade com a LGPD.",
    },
  };
}
