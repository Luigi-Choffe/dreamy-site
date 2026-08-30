import { isBusinessDay, isoAtLocalMinute, sendDateKey, type OutboundEnv } from "./config";
import { computePlan } from "./engine";
import type {
  CampaignDefinition,
  CampaignRuntime,
  Contact,
  CrmTask,
  Deal,
  Enrollment,
  OutboundState,
  PlanItem,
  SendRecord,
  Suppression,
} from "./types";

/**
 * Agenda (PRD §29): o futuro da operação, visível. Funções PURAS que projetam a
 * cadência para os próximos dias usando o MESMO computePlan do motor, rodado
 * dia a dia: cada dia simulado "envia" seus itens (cópias sintéticas, nada é
 * gravado) e alimenta o dia seguinte, então rampa, cadência (+3d/+7d), cap,
 * pausas e supressões entram na conta de verdade.
 *
 * Honestidade: é PREVISÃO. O disparo real refaz o cálculo às 09:05 com o estado
 * daquele momento; respostas, pausas e supressões de amanhã mudam o resultado.
 */

const DAY_MS = 86_400_000;
/** Horário da tarefa automática (dias úteis, 09:05 no fuso de envio). */
const AUTO_MINUTE = 9 * 60 + 5;

export interface ForecastDay {
  /** YYYY-MM-DD no fuso de envio. */
  dateKey: string;
  items: PlanItem[];
}

export interface ForecastResult {
  days: ForecastDay[];
  /** Preenchido quando a operação está travada (breaker/pending): prever seria mentira. */
  blockedReason?: string;
}

export interface ForecastInput {
  contacts: Contact[];
  enrollments: Enrollment[];
  sends: SendRecord[];
  suppressions: Suppression[];
  campaignDefs: CampaignDefinition[];
  runtimes: CampaignRuntime[];
  state: OutboundState;
  env: OutboundEnv;
  now?: Date;
}

export function forecastCadence(input: ForecastInput, horizonDays: number): ForecastResult {
  const env = input.env;
  const now = input.now ?? new Date();
  let sends = [...input.sends];
  let enrollments = input.enrollments.map((e) => ({ ...e }));
  let state = { ...input.state };
  const days: ForecastDay[] = [];
  let blockedReason: string | undefined;

  for (let d = 0; d < horizonDays; d += 1) {
    const dayDate = new Date(now.getTime() + d * DAY_MS);
    if (!isBusinessDay(dayDate, env.utcOffset)) continue;
    const dateKey = sendDateKey(dayDate, env.utcOffset);
    // Dia 0 usa o agora real (janela pode já ter passado); dias seguintes, 09:05.
    const at = d === 0 ? now : new Date(Date.parse(isoAtLocalMinute(dateKey, AUTO_MINUTE, env.utcOffset)));
    const plan = computePlan({
      contacts: input.contacts,
      enrollments,
      sends,
      suppressions: input.suppressions,
      campaignDefs: input.campaignDefs,
      runtimes: input.runtimes,
      state,
      env,
      now: at,
      rng: () => 0.5, // sem jitter: previsão determinística
    });
    if (plan.blockedReason && /breaker|pending/i.test(plan.blockedReason)) {
      blockedReason = plan.blockedReason;
      break;
    }
    days.push({ dateKey, items: plan.items });
    if (plan.items.length === 0) continue;

    // "Envia" o dia simulado para o seguinte enxergar cadência, rampa e idempotência.
    if (!state.firstSendAt) state = { ...state, firstSendAt: plan.items[0]?.scheduledAt };
    const itemByEnrollment = new Map(plan.items.map((item) => [item.enrollmentId, item]));
    enrollments = enrollments.map((enrollment) => {
      const item = itemByEnrollment.get(enrollment.id);
      if (!item) return enrollment;
      return { ...enrollment, nextStep: item.stepIndex + 1, lastSendAt: item.scheduledAt };
    });
    sends = sends.concat(
      plan.items.map((item) => ({
        id: `previsao-${item.campaignSlug}-${item.contactId}-${item.stepId}`,
        enrollmentId: item.enrollmentId,
        contactId: item.contactId,
        campaignSlug: item.campaignSlug,
        stepId: item.stepId,
        idempotencyKey: `${item.campaignSlug}/${item.contactId}/${item.stepId}`,
        status: "sent" as const,
        scheduledAt: item.scheduledAt,
        sentAt: item.scheduledAt,
      })),
    );
  }
  return { days, blockedReason };
}

export interface AgendaDay {
  dateKey: string;
  /** Previsão da cadência (recalculada a cada abertura; o disparo real decide). */
  previstos: PlanItem[];
  /** Já na fila do Resend (compromisso REAL, com hora marcada). */
  agendados: SendRecord[];
  tarefas: CrmTask[];
  reunioes: Deal[];
}

export interface Agenda {
  days: AgendaDay[];
  blockedReason?: string;
  /** Tarefas abertas com dueDate antes de hoje (a aba Hoje cuida delas). */
  tarefasAtrasadas: number;
}

export interface AgendaInput extends ForecastInput {
  tasks: CrmTask[];
  deals: Deal[];
}

/** Une num só calendário: e-mails (previstos + reais no Resend), tarefas e reuniões. */
export function buildAgenda(input: AgendaInput, horizonDays = 10): Agenda {
  const env = input.env;
  const now = input.now ?? new Date();
  const todayKey = sendDateKey(now, env.utcOffset);
  const horizonEnd = sendDateKey(new Date(now.getTime() + (horizonDays - 1) * DAY_MS), env.utcOffset);
  const forecast = forecastCadence(input, horizonDays);
  const byDay = new Map<string, AgendaDay>();
  const day = (dateKey: string): AgendaDay => {
    const found = byDay.get(dateKey);
    if (found) return found;
    const fresh: AgendaDay = { dateKey, previstos: [], agendados: [], tarefas: [], reunioes: [] };
    byDay.set(dateKey, fresh);
    return fresh;
  };

  // Dias úteis do horizonte sempre aparecem (o ritmo da agenda); fim de semana só com conteúdo.
  for (let d = 0; d < horizonDays; d += 1) {
    const dayDate = new Date(now.getTime() + d * DAY_MS);
    if (isBusinessDay(dayDate, env.utcOffset)) day(sendDateKey(dayDate, env.utcOffset));
  }
  for (const f of forecast.days) day(f.dateKey).previstos = f.items;
  for (const send of input.sends) {
    if (send.status !== "scheduled" || !send.scheduledAt) continue;
    const key = sendDateKey(new Date(send.scheduledAt), env.utcOffset);
    if (key < todayKey || key > horizonEnd) continue;
    day(key).agendados.push(send);
  }
  let tarefasAtrasadas = 0;
  for (const task of input.tasks) {
    if (task.status !== "aberta") continue;
    if (task.dueDate < todayKey) {
      tarefasAtrasadas += 1;
      continue;
    }
    if (task.dueDate > horizonEnd) continue;
    day(task.dueDate).tarefas.push(task);
  }
  for (const deal of input.deals) {
    if (!deal.reuniaoEm || deal.stage === "perdido") continue;
    const key = sendDateKey(new Date(deal.reuniaoEm), env.utcOffset);
    if (key < todayKey || key > horizonEnd) continue;
    day(key).reunioes.push(deal);
  }

  const days = [...byDay.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  for (const entry of days) {
    entry.previstos.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    entry.agendados.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    entry.tarefas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    entry.reunioes.sort((a, b) => (a.reuniaoEm ?? "").localeCompare(b.reuniaoEm ?? ""));
  }
  return { days, blockedReason: forecast.blockedReason, tarefasAtrasadas };
}
