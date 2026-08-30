import path from "node:path";
import { campaigns } from "@/content/outbound";
import { openStore } from "@/lib/outbound/store";
import type {
  AgentActivity,
  AiBriefing,
  CampaignDefinition,
  CampaignRuntime,
  Contact,
  CrmNote,
  CrmTask,
  Deal,
  Demand,
  Enrollment,
  ImportBatch,
  OutboundEvent,
  OutboundState,
  Reply,
  SendRecord,
  Suppression,
  WorkspaceSettings,
} from "@/lib/outbound/types";

/**
 * Carregamento de dados do console (`/interno/outbound`).
 *
 * Modo demonstração: com `?demo=1`, o console lê `.outbound-demo/` (populado por
 * `pnpm outbound:demo`) em vez do store real — para ver a plataforma funcionando
 * antes da primeira lista. Os dados de demo são SIMULADOS e rotulados como tal
 * em toda página (banner); nada ali é métrica real.
 */

export const DEMO_DIR_NAME = ".outbound-demo";

export function demoDir(): string {
  return path.join(process.cwd(), DEMO_DIR_NAME);
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function demoRequested(searchParams: SearchParams): boolean {
  const value = searchParams.demo;
  return value === "1" || (Array.isArray(value) && value.includes("1"));
}

/** Preserva o modo demo na navegação interna do console. */
export function consoleHref(pathname: string, isDemo: boolean, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  if (isDemo) params.set("demo", "1");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Defaults de marca quando o documento singleton ainda não existe no store. */
export function defaultWorkspaceSettings(): WorkspaceSettings {
  return {
    id: "workspace",
    empresaNome: "Dreamy",
    operadorNome: "Luigi Choffe",
    ofertas: [
      {
        anchor: "nova-receita",
        titulo: "Nova Receita Digital",
        descricao: "Produto digital que cria uma linha de receita nova para a operação.",
      },
      {
        anchor: "sistema",
        titulo: "Sistemas Sob Medida",
        descricao: "Sistema feito para o processo da casa, no lugar de planilha e retrabalho.",
      },
      {
        anchor: "agente-ia",
        titulo: "Agentes de IA",
        descricao: "Agentes que tiram trabalho repetitivo do time, sempre com controle humano.",
      },
    ],
    atualizadoEm: new Date(0).toISOString(),
  };
}

export interface DashboardData {
  isDemo: boolean;
  defs: CampaignDefinition[];
  contacts: Contact[];
  enrollments: Enrollment[];
  sends: SendRecord[];
  suppressions: Suppression[];
  replies: Reply[];
  events: OutboundEvent[];
  runtimes: CampaignRuntime[];
  imports: ImportBatch[];
  state: OutboundState;
  deals: Deal[];
  notes: CrmNote[];
  tasks: CrmTask[];
  demands: Demand[];
  agentActivities: AgentActivity[];
  briefings: AiBriefing[];
  settings: WorkspaceSettings;
}

export async function loadDashboardData(isDemo: boolean): Promise<DashboardData> {
  const store = isDemo ? openStore(demoDir()) : openStore();
  const [
    contacts,
    enrollments,
    sends,
    suppressions,
    replies,
    events,
    runtimes,
    imports,
    state,
    deals,
    notes,
    tasks,
    demands,
    agentActivities,
    briefings,
    settingsRows,
  ] = await Promise.all([
    store.contacts(),
    store.enrollments(),
    store.sends(),
    store.suppressions(),
    store.replies(),
    store.events(),
    store.campaignRuntimes(),
    store.imports(),
    store.state(),
    store.deals(),
    store.notes(),
    store.tasks(),
    store.demands(),
    store.agentActivities(),
    store.briefings(),
    store.workspaceSettings(),
  ]);
  return {
    isDemo,
    defs: [...campaigns].sort((a, b) => a.slug.localeCompare(b.slug)),
    contacts,
    enrollments,
    sends,
    suppressions,
    replies,
    events,
    runtimes,
    imports,
    state,
    deals,
    notes,
    tasks,
    demands,
    agentActivities,
    briefings,
    settings: settingsRows[0] ?? defaultWorkspaceSettings(),
  };
}
