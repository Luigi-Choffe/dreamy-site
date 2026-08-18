import { routes } from "@/config/site";

export interface NavItem {
  label: string;
  /** Rótulo curto para larguras muito pequenas (opcional). */
  shortLabel?: string;
  href: string;
  /** Sub-itens (dropdown). */
  children?: NavItem[];
  /** Descrição curta para o dropdown. */
  description?: string;
}

export interface NavigationModel {
  primary: NavItem[];
  cta: NavItem;
  footer: {
    solutions: NavItem[];
    company: NavItem[];
    legal: NavItem[];
  };
}

export interface NavigationFlags {
  /** true quando existe ≥ 1 case aprovado */
  hasCases: boolean;
  /** true quando existem ≥ 3 insights publicados */
  hasInsights: boolean;
}

/** Itens de solução — exatamente três (PRD §14). */
export const solutionNavItems: NavItem[] = [
  {
    label: "Nova Receita Digital",
    href: routes.solutionNewRevenue,
    description: "Crie o próximo produto que seus clientes podem comprar.",
  },
  {
    label: "Sistemas Sob Medida",
    href: routes.solutionCustomSystems,
    description: "Construa tecnologia em torno da sua operação.",
  },
  {
    label: "Agentes de IA",
    href: routes.solutionAiAgents,
    description: "Faça a IA executar trabalho real.",
  },
];

/** Monta a navegação respeitando os gates de conteúdo (PRD §13). */
export function buildNavigation(flags: NavigationFlags): NavigationModel {
  const primary: NavItem[] = [{ label: "Soluções", href: routes.solutions, children: solutionNavItems }];
  if (flags.hasCases) primary.push({ label: "Cases", href: routes.cases });
  primary.push({ label: "Como trabalhamos", href: routes.howWeWork });
  primary.push({ label: "Sobre", href: routes.about });
  if (flags.hasInsights) primary.push({ label: "Insights", href: routes.insights });

  const company: NavItem[] = [{ label: "Sobre", href: routes.about }];
  if (flags.hasCases) company.push({ label: "Cases", href: routes.cases });
  if (flags.hasInsights) company.push({ label: "Insights", href: routes.insights });
  company.push({ label: "Como trabalhamos", href: routes.howWeWork });
  company.push({ label: "Contato", href: routes.contact });

  return {
    primary,
    cta: { label: "Agendar conversa", shortLabel: "Agendar", href: routes.contact },
    footer: {
      solutions: solutionNavItems,
      company,
      legal: [
        { label: "Política de Privacidade", href: routes.privacy },
        { label: "Política de Cookies", href: routes.cookies },
      ],
    },
  };
}
