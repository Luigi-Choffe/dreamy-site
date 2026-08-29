/**
 * `pnpm outbound:sync` — sincroniza o estado dos envios com o Resend por POLLING
 * (`GET /emails/:id`), já que a V1 local não tem webhook público (PRD §13 adaptado).
 *
 * Efeitos aplicados (sync-core é puro; o I/O acontece aqui):
 * - transições de status dos sends + eventos com dedupe por sourceKey;
 * - bounce → supressão hard_bounce + parada do enrollment;
 * - complaint → supressão complaint + parada + CIRCUIT BREAKER GLOBAL (PRD §21)
 *   com cancelamento de todos os sends agendados;
 * - bounce rate ≥ 3% na campanha → pausa da campanha + cancelamento dos agendados dela.
 *
 * Sem PII nos logs: só ids e contagens.
 */
import { parseArgs } from "node:util";
import { campaigns } from "../../src/content/outbound";
import { logger } from "../../src/lib/observability/logger";
import { cancelScheduledSends } from "../../src/lib/outbound/cancel";
import { getOutboundEnv } from "../../src/lib/outbound/config";
import { evaluateGuardRails } from "../../src/lib/outbound/guardrails";
import { createResendClient } from "../../src/lib/outbound/resend";
import type { ResendClient } from "../../src/lib/outbound/resend";
import { openStore, runExclusive } from "../../src/lib/outbound/store";
import { applySync, chunk, isPollable } from "../../src/lib/outbound/sync-core";
import type { SendRecord } from "../../src/lib/outbound/types";

/** Rate limit do Resend: 10 req/s — lotes de 5 com pausa de 250 ms ficam com folga. */
const POLL_CONCURRENCY = 5;
const BATCH_PAUSE_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PollOutcome {
  send: SendRecord;
  lastEvent?: string | null;
  error?: string;
}

async function pollAll(client: ResendClient, sends: SendRecord[]): Promise<PollOutcome[]> {
  const out: PollOutcome[] = [];
  const batches = chunk(sends, POLL_CONCURRENCY);
  for (let i = 0; i < batches.length; i++) {
    const results = await Promise.all(
      batches[i]!.map(async (send): Promise<PollOutcome> => {
        try {
          const status = await client.getEmail(send.resendEmailId!);
          return { send, lastEvent: status.last_event };
        } catch (err) {
          return { send, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
    out.push(...results);
    if (i < batches.length - 1) await sleep(BATCH_PAUSE_MS);
  }
  return out;
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  parseArgs({ args: process.argv.slice(2), options: {}, strict: true });

  const env = getOutboundEnv();
  if (!env.apiKey) {
    console.error("✖ OUTBOUND_RESEND_API_KEY ausente — defina em .env.local (nomes em .env.example).");
    process.exit(1);
  }
  const client = createResendClient(env.apiKey);
  const store = openStore();
  const [sends, contacts, enrollments, runtimes] = await Promise.all([
    store.sends(),
    store.contacts(),
    store.enrollments(),
    store.campaignRuntimes(),
  ]);
  const state = await store.state();
  const now = new Date();

  // Não-terminais sempre; delivered por até 30 dias após o envio (bounce tardio, opened/clicked).
  const pollable = sends.filter((s) => isPollable(s, now));
  console.log(`Sync Resend — ${pollable.length} send(s) a consultar (de ${sends.length} no store).`);
  if (pollable.length === 0 && !state.breakerTrippedAt) {
    console.log("Nada a fazer.");
    return;
  }

  const outcomes = await pollAll(client, pollable);

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));
  const sendById = new Map(sends.map((s) => [s.id, s]));

  let falhasConsulta = 0;
  let eventosNovos = 0;
  let supressoesNovas = 0;
  let enrollmentsParados = 0;
  let contactsDirty = false;
  let complaintDetectado = false;
  const mudancas = new Map<string, number>();
  const bump = (key: string) => mudancas.set(key, (mudancas.get(key) ?? 0) + 1);

  for (const outcome of outcomes) {
    if (outcome.error !== undefined) {
      falhasConsulta++;
      logger.warn("outbound.sync.consulta_falhou", { sendId: outcome.send.id, error: outcome.error });
      continue;
    }
    const prev = outcome.send;
    const contact = contactById.get(prev.contactId);
    const result = applySync(prev, { last_event: outcome.lastEvent ?? null }, contact?.email ?? "", now);

    if (result.send.status !== prev.status) bump(`status→${result.send.status}`);
    if (result.send.opened && !prev.opened) bump("opened");
    if (result.send.clicked && !prev.clicked) bump("clicked");
    sendById.set(prev.id, result.send);

    for (const event of result.events) {
      if (await store.appendEvent(event)) eventosNovos++;
    }
    if (result.suppression && contact) {
      const added = await store.suppress({
        email: contact.email,
        reason: result.suppression.reason,
        origin: prev.campaignSlug,
      });
      if (added) supressoesNovas++;
      if (contact.status !== "suppressed") {
        contact.status = "suppressed";
        contactsDirty = true;
      }
    }
    if (result.stopEnrollment) {
      const enrollment = enrollmentById.get(prev.enrollmentId);
      if (enrollment && enrollment.status === "active") {
        enrollment.status = "stopped";
        enrollment.stopReason = result.stopEnrollment;
        enrollmentsParados++;
      }
    }
    if (result.tripGlobalBreaker) complaintDetectado = true;
  }

  const updatedSends = sends.map((s) => sendById.get(s.id) ?? s);
  const defsBySlug = new Map(campaigns.map((d) => [d.slug, d]));

  // Complaint dispara o breaker GLOBAL (religar exige ação humana — outbound:arm reset-breaker).
  // O state é salvo IMEDIATAMENTE: se o processo morrer durante os cancelamentos, o
  // breaker não pode se perder (o próximo run continua cancelando, defensivo).
  let breakerNovo = false;
  if (complaintDetectado && !state.breakerTrippedAt) {
    state.breakerTrippedAt = now.toISOString();
    state.breakerReason = "complaint detectado no sync (PRD §21: complaint > 0,1% pausa TODAS as campanhas)";
    breakerNovo = true;
    await store.saveState(state);
  }

  let cancelados = 0;
  let cancelFalhas = 0;
  let rebobinados = 0;
  if (state.breakerTrippedAt) {
    const r = await cancelScheduledSends(client, store, {
      sends: updatedSends,
      enrollments,
      defsBySlug,
      match: () => true,
      motivo: "breaker global",
      now,
    });
    cancelados += r.canceled;
    cancelFalhas += r.failures;
    rebobinados += r.rewound;
  }

  // Guard-rail por campanha: bounce ≥ 3% com amostra mínima pausa a campanha e cancela agendados.
  const runtimeBySlug = new Map(runtimes.map((r) => [r.slug, r]));
  const campanhasPausadas: string[] = [];
  for (const slug of new Set(updatedSends.map((s) => s.campaignSlug))) {
    const rails = evaluateGuardRails(updatedSends, slug);
    if (!rails.bounceTripped) continue;
    let runtime = runtimeBySlug.get(slug);
    if (!runtime) {
      runtime = { slug };
      runtimes.push(runtime);
      runtimeBySlug.set(slug, runtime);
    }
    if (!runtime.pausedAt) {
      runtime.pausedAt = now.toISOString();
      runtime.pausedReason = "bounce-rate";
      campanhasPausadas.push(slug);
    }
    const r = await cancelScheduledSends(client, store, {
      sends: updatedSends,
      enrollments,
      defsBySlug,
      match: (s) => s.campaignSlug === slug,
      motivo: `bounce-rate da campanha ${slug}`,
      now,
    });
    cancelados += r.canceled;
    cancelFalhas += r.failures;
    rebobinados += r.rewound;
  }

  await store.saveSends(updatedSends);
  await store.saveEnrollments(enrollments);
  if (contactsDirty) await store.saveContacts(contacts);
  await store.saveCampaignRuntimes(runtimes);
  await store.saveState(state);

  console.log("");
  console.log("Resultado do sync");
  console.log(`  consultados:         ${outcomes.length}`);
  console.log(`  falhas de consulta:  ${falhasConsulta}`);
  const mudancasStr =
    [...mudancas.entries()]
      .map(([key, count]) => `${key}=${count}`)
      .sort()
      .join("  ") || "nenhuma";
  console.log(`  mudanças:            ${mudancasStr}`);
  console.log(`  eventos novos:       ${eventosNovos}`);
  console.log(`  supressões novas:    ${supressoesNovas}`);
  console.log(`  enrollments parados: ${enrollmentsParados}`);
  if (campanhasPausadas.length > 0) console.log(`  campanhas pausadas (bounce): ${campanhasPausadas.join(", ")}`);
  if (cancelados > 0 || cancelFalhas > 0)
    console.log(`  agendados cancelados: ${cancelados} (falhas: ${cancelFalhas} — os já enviados não têm volta)`);
  if (rebobinados > 0)
    console.log(`  enrollments rebobinados: ${rebobinados} (passo cancelado volta a ser elegível após religar)`);
  console.log(
    state.breakerTrippedAt
      ? `  breaker global:      DISPARADO em ${state.breakerTrippedAt}${breakerNovo ? " (AGORA)" : ""} — ${state.breakerReason ?? "sem motivo registrado"}`
      : "  breaker global:      ok",
  );

  logger.info("outbound.sync", {
    consultados: outcomes.length,
    falhasConsulta,
    eventosNovos,
    supressoesNovas,
    enrollmentsParados,
    cancelados,
    cancelFalhas,
    rebobinados,
    breaker: Boolean(state.breakerTrippedAt),
    campanhasPausadas,
  });

  if (falhasConsulta > 0 || cancelFalhas > 0) process.exit(1);
}

runExclusive("sync", main).catch((err) => {
  console.error(`✖ sync falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
