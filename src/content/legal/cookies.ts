import { routes, siteConfig } from "@/config/site";
import type { LegalDocument } from "./privacy";

/**
 * Política de Cookies — rascunho estruturado para validação jurídica (PRD §73–§74).
 * Categorias alinhadas ao gerenciador de consentimento: necessário, analytics, marketing.
 */
export function getCookiesPolicy(): LegalDocument {
  return {
    title: "Política de Cookies",
    updatedAt: "2026-08-17",
    intro: `Esta política explica quais cookies e tecnologias semelhantes o site ${siteConfig.url} utiliza, para que servem e como você pode gerenciá-los. Ela complementa a Política de Privacidade (${siteConfig.url}${routes.privacy}).`,
    sections: [
      {
        title: "1. O que são cookies",
        paragraphs: [
          "Cookies são pequenos arquivos armazenados no seu navegador. Também usamos armazenamento local do navegador (localStorage/sessionStorage) para finalidades equivalentes.",
        ],
      },
      {
        title: "2. Categorias que utilizamos",
        items: [
          "Necessários: indispensáveis ao funcionamento do site e à sua segurança — por exemplo, o registro da sua escolha de consentimento (cookie `dreamy_consent`, validade de 6 meses) e a manutenção, durante a visita, dos parâmetros de origem da campanha para que o formulário de contato os registre. Não exigem consentimento.",
          "Análise (analytics): ajudam a entender como o site é usado (páginas visitadas, origem do acesso, interações), por meio do Google Analytics 4 carregado via Google Tag Manager. Ativados apenas com o seu consentimento.",
          "Marketing: permitem medir campanhas e conversões em plataformas de publicidade, como Meta (Facebook/Instagram) e LinkedIn. Ativados apenas com o seu consentimento.",
        ],
      },
      {
        title: "3. Consentimento e gerenciamento",
        paragraphs: [
          "Na primeira visita, apresentamos um aviso com as opções de aceitar, rejeitar ou gerenciar cookies por categoria. Sem a sua escolha, apenas os cookies necessários são utilizados e as ferramentas de análise e marketing permanecem desativadas (Google Consent Mode em estado negado).",
          'Você pode alterar sua escolha a qualquer momento pelo link "Preferências de cookies" no rodapé do site. Também é possível apagar ou bloquear cookies nas configurações do seu navegador; nesse caso, algumas funcionalidades podem ser afetadas.',
        ],
      },
      {
        title: "4. Dados enviados às ferramentas",
        paragraphs: [
          "Dados informados no formulário de contato (nome, e-mail, telefone, empresa, texto do problema) nunca são enviados às ferramentas de análise ou marketing. Os eventos medidos são anônimos em relação a esses dados (por exemplo: página visualizada, clique em botão, envio de formulário concluído).",
        ],
      },
      {
        title: "5. Alterações",
        paragraphs: ["Esta política pode ser atualizada. A data da última atualização é indicada no topo da página."],
      },
    ],
    seo: {
      title: "Política de Cookies | Dreamy",
      description:
        "Quais cookies o site da Dreamy utiliza, para que servem e como gerenciar suas preferências de consentimento.",
    },
  };
}
