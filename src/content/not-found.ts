import { routes } from "@/config/site";

/** Página 404 — PRD §80. */
export const notFoundContent = {
  title: "Parece que esta página não existe.",
  text: "O endereço pode ter mudado ou nunca existiu. Você pode voltar para o início ou conhecer as nossas soluções.",
  primary: { label: "Voltar para a Dreamy", href: routes.home },
  secondary: { label: "Conhecer nossas soluções", href: routes.solutions },
};

export const errorContent = {
  title: "Algo não funcionou como esperado.",
  text: "Ocorreu um erro ao carregar esta página. Você pode tentar novamente ou voltar para o início.",
  retry: "Tentar novamente",
  home: { label: "Voltar para a Dreamy", href: routes.home },
};
