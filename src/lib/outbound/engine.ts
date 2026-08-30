import { isBusinessDay, isoAtLocalMinute, localParts, rampCap, sendDateKey, type OutboundEnv } from "./config";
import { evaluateGuardRails } from "./guardrails";
import { buildEmail, campaignContentHash, lintEmail, lintErrors } from "./render";
import { normalizeEmail } from "./store";
import type {
  CampaignDefinition,
  CampaignRuntime,
  Contact,
  Enrollment,
  OutboundState,
  PlanItem,
  SendRecord,
  Suppression,
} from "./types";

/**
 * Motor de planejamento (PRD §7, §12, §17, §21) — funções puras: recebem o estado
 * completo e devolvem decisões. Nada de fs/fetch aqui (testável com dados fixos).
 */

/** Espaço mínimo entre envios dentro da janela (goteo, nunca rajada — PRD §17). */
export const MIN_GAP_MIN = 3;
/** Primeiro envio do dia nunca antes de agora + 10 min (margem para revisão/cancelamento). */
export const LEAD_TIME_MIN = 10;

export interface PlanInput {
  contacts: Contact[];
  enrollments: Enrollment[];
  sends: SendRecord[];
  suppressions: Suppression[];
  campaignDefs: CampaignDefinition[];
  runtimes: CampaignRuntime[];
  state: OutboundState;
  env: OutboundEnv;
  now: Date;
  /** Jitter do agendamento (injetável em teste). */
  rng?: () => number;
  /** Restringe o plano a uma campanha. */
  campaignFilter?: string;
}

export interface PlanSkip {
  enrollmentId: string;
  reason: string;
}

export interface PlanResult {
  items: PlanItem[];
  skipped: PlanSkip[];
  capInfo: { cap: number; usedToday: number; available: number };
  /** Preenchido quando NADA pode ser planejado hoje (breaker, fim de semana, janela). */
  blockedReason?: string;
}

/** Envios que contam para o cap do dia (agendados/enviados hoje; canceled/failed não). */
export function usedTodayCount(sends: SendRecord[], now: Date, utcOffset: string): number {
  const today = sendDateKey(now, utcOffset);
  return sends.filter((s) => {
    if (s.status === "canceled" || s.status === "failed") return false;
    const ref = s.scheduledAt ?? s.sentAt;
    return ref !== undefined && sendDateKey(new Date(ref), utcOffset) === today;
  }).length;
}

export function dailyCap(state: OutboundState, env: OutboundEnv, now: Date): number {
  const candidates = [rampCap(state.firstSendAt, now)];
  if (state.dailyCapOverride !== undefined) candidates.push(state.dailyCapOverride);
  if (env.dailyCapEnv !== null) candidates.push(env.dailyCapEnv);
  return Math.max(0, Math.min(...candidates));
}

interface Candidate {
  enrollment: Enrollment;
  contact: Contact;
  def: CampaignDefinition;
  stepIndex: number;
}

export function computePlan(input: PlanInput): PlanResult {
  const { now, env, state, rng = Math.random } = input;
  const cap = dailyCap(state, env, now);
  const usedToday = usedTodayCount(input.sends, now, env.utcOffset);
  const capInfo = { cap, usedToday, available: Math.max(0, cap - usedToday) };
  const blocked = (reason: string): PlanResult => ({
    items: [],
    skipped: [],
    capInfo,
    blockedReason: reason,
  });

  if (state.breakerTrippedAt) {
    return blocked(
      `circuit breaker global disparado em ${state.breakerTrippedAt} (${state.breakerReason ?? "sem motivo registrado"}) — religar exige outbound:arm reset-breaker --confirm`,
    );
  }
  const pendings = input.sends.filter((s) => s.status === "pending");
  if (pendings.length > 0) {
    return blocked(
      `${pendings.length} envio(s) "pending" de um run interrompido — confira o painel do Resend e resolva com outbound:send --resolve-pending <failed|sent> antes de qualquer envio novo`,
    );
  }
  if (!isBusinessDay(now, env.utcOffset)) return blocked("fora de dia útil (envios só de segunda a sexta)");

  const { minutesOfDay, date: today } = localParts(now, env.utcOffset);
  const windowStart = Math.max(minutesOfDay + LEAD_TIME_MIN, env.window.startMin);
  if (windowStart >= env.window.endMin) {
    return blocked("janela de envio encerrada por hoje (PRD §7: janela comercial)");
  }
  if (capInfo.available === 0) return blocked(`cap diário atingido (${usedToday}/${cap})`);

  const defsBySlug = new Map(input.campaignDefs.map((d) => [d.slug, d]));
  const runtimesBySlug = new Map(input.runtimes.map((r) => [r.slug, r]));
  const contactsById = new Map(input.contacts.map((c) => [c.id, c]));
  const suppressed = new Set(input.suppressions.map((s) => normalizeEmail(s.email)));
  // Canceled/failed NÃO bloqueiam replanejamento: um passo cancelado pelo breaker
  // (com enrollment rebobinado pelo sync) precisa poder ser re-agendado.
  const sentKeys = new Set(
    input.sends.filter((s) => s.status !== "canceled" && s.status !== "failed").map((s) => s.idempotencyKey),
  );
  const contentHashCache = new Map<string, string>();
  const bounceTrippedCache = new Map<string, boolean>();

  const skipped: PlanSkip[] = [];
  const skip = (enrollmentId: string, reason: string) => skipped.push({ enrollmentId, reason });
  const byCampaign = new Map<string, Candidate[]>();

  for (const enrollment of input.enrollments) {
    if (enrollment.status !== "active") continue;
    if (input.campaignFilter && enrollment.campaignSlug !== input.campaignFilter) continue;

    const def = defsBySlug.get(enrollment.campaignSlug);
    if (!def) {
      skip(enrollment.id, "campanha sem definição no registry (src/content/outbound)");
      continue;
    }
    if (def.status !== "ready") {
      skip(enrollment.id, `campanha "${def.slug}" em draft`);
      continue;
    }
    const runtime = runtimesBySlug.get(def.slug);
    if (!runtime?.approvedAt) {
      skip(enrollment.id, `campanha "${def.slug}" sem aprovação (outbound:campaign approve)`);
      continue;
    }
    if (runtime.pausedAt) {
      skip(enrollment.id, `campanha "${def.slug}" pausada (${runtime.pausedReason ?? "manual"})`);
      continue;
    }
    let contentHash = contentHashCache.get(def.slug);
    if (contentHash === undefined) {
      contentHash = campaignContentHash(def);
      contentHashCache.set(def.slug, contentHash);
    }
    if (runtime.approvedHash !== contentHash) {
      skip(
        enrollment.id,
        `copy de "${def.slug}" mudou depois da aprovação (ou aprovação antiga sem hash) — rode outbound:campaign approve novamente`,
      );
      continue;
    }
    let bounceTripped = bounceTrippedCache.get(def.slug);
    if (bounceTripped === undefined) {
      bounceTripped = evaluateGuardRails(input.sends, def.slug).bounceTripped;
      bounceTrippedCache.set(def.slug, bounceTripped);
    }
    if (bounceTripped) {
      skip(enrollment.id, `campanha "${def.slug}" com bounce acima do guard-rail (PRD §21)`);
      continue;
    }

    const contact = contactsById.get(enrollment.contactId);
    if (!contact) {
      skip(enrollment.id, "contato não encontrado no store");
      continue;
    }
    if (contact.status !== "active") {
      skip(enrollment.id, `contato ${contact.status} (${contact.excludedReason ?? "sem motivo"})`);
      continue;
    }
    if (contact.verification !== "ok") {
      skip(enrollment.id, `verificação "${contact.verification}" (só "ok" recebe e-mail — PRD §11)`);
      continue;
    }
    if (suppressed.has(contact.email)) {
      skip(enrollment.id, "e-mail na lista de supressão");
      continue;
    }

    if (enrollment.nextStep >= def.steps.length) {
      skip(enrollment.id, "sequência concluída (marcar finished no próximo send)");
      continue;
    }
    const step = def.steps[enrollment.nextStep];
    if (enrollment.nextStep > 0) {
      if (!enrollment.lastSendAt) {
        skip(enrollment.id, "sem lastSendAt registrado para calcular cadência");
        continue;
      }
      const dueAt = new Date(enrollment.lastSendAt).getTime() + step.offsetDays * 86_400_000;
      if (dueAt > now.getTime()) {
        skip(enrollment.id, `aguardando cadência do passo ${step.id} (+${step.offsetDays}d)`);
        continue;
      }
    }

    const idempotencyKey = `${def.slug}/${contact.id}/${step.id}`;
    if (sentKeys.has(idempotencyKey)) {
      skip(enrollment.id, `passo ${step.id} já enviado (idempotência)`);
      continue;
    }

    try {
      const built = buildEmail(contact, def, step, {
        replyTo: env.replyTo ?? "reply@pendente",
      });
      const errors = lintErrors(lintEmail(built.subject, built.text, { subjectTemplate: step.subject }));
      if (errors.length > 0) {
        skip(enrollment.id, `lint da copy: ${errors.map((e) => `${e.rule} (${e.detail})`).join("; ")}`);
        continue;
      }
    } catch (err) {
      skip(enrollment.id, err instanceof Error ? err.message : String(err));
      continue;
    }

    const list = byCampaign.get(def.slug) ?? [];
    list.push({ enrollment, contact, def, stepIndex: enrollment.nextStep });
    byCampaign.set(def.slug, list);
  }

  // Prioridade: follow-ups antes de e1 (sequência aberta não envelhece); round-robin entre campanhas.
  for (const list of byCampaign.values()) {
    list.sort((a, b) => b.stepIndex - a.stepIndex || a.enrollment.createdAt.localeCompare(b.enrollment.createdAt));
  }
  const queues = [...byCampaign.keys()].sort().map((slug) => byCampaign.get(slug) as Candidate[]);
  const windowSpan = env.window.endMin - windowStart;
  const windowCapacity = Math.floor(windowSpan / MIN_GAP_MIN) + 1;
  const target = Math.min(capInfo.available, windowCapacity);

  const chosen: Candidate[] = [];
  let qi = 0;
  while (chosen.length < target && queues.some((q) => q.length > 0)) {
    const queue = queues[qi % queues.length];
    qi += 1;
    const candidate = queue.shift();
    if (candidate) chosen.push(candidate);
  }
  for (const queue of queues) {
    for (const left of queue) skip(left.enrollment.id, "fora do cap/janela de hoje (fica para o próximo dia útil)");
  }

  // Goteo com jitter: intervalo base uniforme na janela restante, ±40%, mínimo 3 min.
  const items: PlanItem[] = [];
  if (chosen.length > 0) {
    const base = windowSpan / chosen.length;
    let prev = -Infinity;
    for (let i = 0; i < chosen.length; i += 1) {
      const jitter = (rng() - 0.5) * 0.8 * base;
      let minute = windowStart + i * base + jitter;
      minute = Math.max(minute, prev + MIN_GAP_MIN, windowStart);
      minute = Math.min(minute, env.window.endMin - 1);
      prev = minute;
      const c = chosen[i];
      items.push({
        enrollmentId: c.enrollment.id,
        contactId: c.contact.id,
        email: c.contact.email,
        campaignSlug: c.def.slug,
        stepId: c.def.steps[c.stepIndex].id,
        stepIndex: c.stepIndex,
        scheduledAt: isoAtLocalMinute(today, Math.round(minute), env.utcOffset),
      });
    }
  }

  return { items, skipped, capInfo };
}
