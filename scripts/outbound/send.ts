/**
 * `pnpm outbound:send [--campaign <slug>] [--confirm] [--yes] [--resolve-pending <failed|sent>]`
 * — executa o plano do dia (PRD §12).
 *
 * SEM --confirm: dry-run (mostra o que enviaria e sai).
 * COM --confirm: exige automação armada (outbound:arm) + env completa; o plano é
 * recomputado DEPOIS da confirmação (horários nunca ficam no passado) e cada lote é
 * gravado como "pending" ANTES da chamada ao Resend (write-ahead): se o processo
 * morrer no meio, nada se perde nem duplica — os "pending" bloqueiam envios novos
 * até serem resolvidos com --resolve-pending (conferindo o painel do Resend).
 */
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { campaigns } from "../../src/content/outbound";
import { logger } from "../../src/lib/observability/logger";
import { assertSendReady, getOutboundEnv, sendDateKey } from "../../src/lib/outbound/config";
import { buildEmail } from "../../src/lib/outbound/render";
import { createResendClient, ResendApiError, type ResendEmailPayload } from "../../src/lib/outbound/resend";
import { newId, openStore, runExclusive } from "../../src/lib/outbound/store";
import type { CampaignDefinition, Enrollment, PlanItem, SendRecord } from "../../src/lib/outbound/types";
import { buildPlan } from "./plan";

const BATCH_LIMIT = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function confirmInteractive(): Promise<boolean> {
  if (!process.stdin.isTTY) return true;
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('  Digite "ENVIAR" para confirmar o disparo real: ');
  rl.close();
  return answer.trim() === "ENVIAR";
}

/** Avança a sequência após envio bem-sucedido (ou resolução --resolve-pending sent). */
function advanceEnrollment(
  enrollment: Enrollment,
  send: Pick<SendRecord, "stepId" | "scheduledAt">,
  def: CampaignDefinition | undefined,
): void {
  const stepIndex = def ? def.steps.findIndex((s) => s.id === send.stepId) : -1;
  if (stepIndex < 0) return;
  enrollment.nextStep = Math.max(enrollment.nextStep, stepIndex + 1);
  if (send.scheduledAt) enrollment.lastSendAt = send.scheduledAt;
  if (def && enrollment.nextStep >= def.steps.length && enrollment.status === "active") {
    enrollment.status = "finished";
  }
}

/** Resolve sends "pending" de um run interrompido, após conferência humana no painel do Resend. */
async function resolvePending(mode: string): Promise<void> {
  if (mode !== "failed" && mode !== "sent") {
    console.error('✖ --resolve-pending aceita "failed" (o lote NÃO saiu) ou "sent" (o lote SAIU — confira no painel).');
    process.exit(1);
  }
  const store = openStore();
  const sends = await store.sends();
  const pendings = sends.filter((s) => s.status === "pending");
  if (pendings.length === 0) {
    console.log("Nenhum send pending — nada a resolver.");
    return;
  }
  if (mode === "failed") {
    for (const send of pendings) {
      send.status = "failed";
      send.error = "resolvido manualmente: lote não chegou ao Resend";
    }
    await store.saveSends(sends);
    console.log(`✓ ${pendings.length} pending(s) marcados como failed — o plano volta a considerá-los.`);
  } else {
    // O lote FOI aceito pelo Resend: registrar como scheduled (sem resendEmailId — não
    // aparecerá no sync; acompanhe pelo painel) e avançar as sequências como no envio.
    const defsBySlug = new Map(campaigns.map((d) => [d.slug, d]));
    const enrollments = await store.enrollments();
    const byId = new Map(enrollments.map((e) => [e.id, e]));
    for (const send of pendings) {
      send.status = "scheduled";
      send.error = "resolvido manualmente: aceito pelo Resend, sem id local (sem sync)";
      const enrollment = byId.get(send.enrollmentId);
      if (enrollment) advanceEnrollment(enrollment, send, defsBySlug.get(send.campaignSlug));
    }
    await store.saveSends(sends);
    await store.saveEnrollments(enrollments);
    console.log(
      `✓ ${pendings.length} pending(s) marcados como scheduled (sem id do Resend — acompanhe esses pelo painel).`,
    );
  }
  logger.info("outbound.send.resolve_pending", { mode, count: pendings.length });
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      campaign: { type: "string" },
      confirm: { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      "resolve-pending": { type: "string" },
    },
    strict: true,
  });

  if (values["resolve-pending"] !== undefined) {
    await resolvePending(values["resolve-pending"]);
    return;
  }

  const preview = await buildPlan(values.campaign);
  if (preview.blockedReason) {
    console.log(`Nada a enviar: ${preview.blockedReason}`);
    return;
  }
  if (preview.items.length === 0) {
    console.log(`Nada a enviar agora (${preview.skipped.length} pulados — detalhe em pnpm outbound:plan).`);
    return;
  }

  console.log(`Plano: ${preview.items.length} e-mail(s) · cap ${preview.capInfo.usedToday}/${preview.capInfo.cap}.`);
  if (!values.confirm) {
    console.log("Dry-run — nenhum e-mail enviado. Use --confirm para disparo real.");
    return;
  }

  const store = openStore();
  const state = await store.state();
  if (!state.armed) {
    console.error("✖ Automação desarmada. Arme explicitamente com: pnpm outbound:arm arm --confirm");
    process.exit(1);
  }
  const env = getOutboundEnv();
  assertSendReady(env);
  if (!values.yes && !(await confirmInteractive())) {
    console.log("Cancelado — nada foi enviado.");
    return;
  }

  // Recomputa DEPOIS da confirmação: se o operador demorou, os horários seriam
  // passados/apertados — o plano exibido era informativo, este é o executado.
  const plan = await buildPlan(values.campaign);
  if (plan.blockedReason) {
    console.log(`Nada a enviar (replanejado após a confirmação): ${plan.blockedReason}`);
    return;
  }
  if (plan.items.length === 0) {
    console.log("Nada a enviar após o replanejamento (janela/cadência mudou durante a confirmação).");
    return;
  }

  const defsBySlug = new Map(campaigns.map((d) => [d.slug, d]));
  const contacts = await store.contacts();
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  const client = createResendClient(env.apiKey);

  const prepared: Array<{ item: PlanItem; sendId: string; payload: ResendEmailPayload }> = [];
  for (const item of plan.items) {
    const def = defsBySlug.get(item.campaignSlug);
    const contact = contactsById.get(item.contactId);
    const step = def?.steps[item.stepIndex];
    if (!def || !contact || !step) {
      throw new Error(`Plano inconsistente para enrollment ${item.enrollmentId} — replaneje.`);
    }
    const sendId = newId();
    const built = buildEmail(contact, def, step, { replyTo: env.replyTo });
    prepared.push({
      item,
      sendId,
      payload: {
        from: env.from,
        to: [contact.email],
        subject: built.subject,
        text: built.text,
        html: built.html,
        reply_to: env.replyTo,
        headers: { ...built.headers, "X-Entity-Ref-ID": sendId },
        tags: [
          { name: "campaign", value: item.campaignSlug },
          { name: "contact", value: item.contactId },
          { name: "step", value: item.stepId },
        ],
        scheduled_at: item.scheduledAt,
      },
    });
  }

  const today = sendDateKey(new Date(), env.utcOffset);
  const confirmed: SendRecord[] = [];
  for (const batch of chunk(prepared, BATCH_LIMIT)) {
    // 1. WRITE-AHEAD: registrar como "pending" ANTES de chamar o Resend. Se o processo
    //    morrer entre a aceitação do batch e a gravação, o registro já existe — sem
    //    e-mail fantasma fora do cap/idempotência/guard-rails.
    const batchSends: SendRecord[] = batch.map((p) => ({
      id: p.sendId,
      enrollmentId: p.item.enrollmentId,
      contactId: p.item.contactId,
      campaignSlug: p.item.campaignSlug,
      stepId: p.item.stepId,
      idempotencyKey: `${p.item.campaignSlug}/${p.item.contactId}/${p.item.stepId}`,
      scheduledAt: p.item.scheduledAt,
      status: "pending" as const,
    }));
    {
      const sends = await store.sends();
      await store.saveSends([...sends, ...batchSends]);
    }

    const batchHash = createHash("sha256")
      .update(batch.map((p) => `${p.item.campaignSlug}/${p.item.contactId}/${p.item.stepId}`).join("|"))
      .digest("hex")
      .slice(0, 16);

    let ids: string[];
    try {
      ids = await client.sendBatch(
        batch.map((p) => p.payload),
        `auto/${today}/${batchHash}`,
      );
    } catch (err) {
      const sends = await store.sends();
      const byId = new Map(sends.map((s) => [s.id, s]));
      if (err instanceof ResendApiError) {
        // Erro definitivo do Resend: o lote NÃO foi aceito — marcar failed libera o replano.
        for (const p of batch) {
          const record = byId.get(p.sendId);
          if (record) {
            record.status = "failed";
            record.error = `Resend HTTP ${err.status}`;
          }
        }
        await store.saveSends(sends);
        console.error(`✖ Lote rejeitado pelo Resend (HTTP ${err.status}) — nada foi enviado deste lote.`);
        console.error("  Registros marcados como failed; corrija a causa e rode outbound:send de novo.");
      } else {
        // Timeout/rede: não dá para saber se o Resend aceitou — os "pending" ficam
        // registrados e BLOQUEIAM novos envios até resolução humana.
        console.error(`✖ Falha de rede/timeout no lote: ${err instanceof Error ? err.message : String(err)}`);
        console.error(
          `  ${batch.length} envio(s) ficaram como "pending". Confira no painel do Resend se o lote saiu e resolva:`,
        );
        console.error("    outbound:send --resolve-pending sent    (o lote APARECE no painel)");
        console.error("    outbound:send --resolve-pending failed  (o lote NÃO aparece)");
      }
      logger.error("outbound.send.batch_falhou", {
        lote: batch.length,
        definitivo: err instanceof ResendApiError,
      });
      process.exit(1);
    }

    // 2. Sucesso: promover pending → scheduled com o id do Resend e avançar sequências.
    {
      const sends = await store.sends();
      const byId = new Map(sends.map((s) => [s.id, s]));
      batch.forEach((p, i) => {
        const record = byId.get(p.sendId);
        if (!record) return;
        record.status = "scheduled";
        record.resendEmailId = ids[i];
        record.sentAt = new Date().toISOString();
        confirmed.push(record);
      });
      await store.saveSends(sends);
      for (const p of batch) {
        await store.appendEvent({
          sendId: p.sendId,
          campaignSlug: p.item.campaignSlug,
          type: "sent",
          sourceKey: `send:${p.sendId}`,
          occurredAt: new Date().toISOString(),
        });
      }
      const enrollments = await store.enrollments();
      const byEnrollment = new Map(enrollments.map((e) => [e.id, e]));
      for (const p of batch) {
        const enrollment = byEnrollment.get(p.item.enrollmentId);
        if (!enrollment) continue;
        advanceEnrollment(
          enrollment,
          { stepId: p.item.stepId, scheduledAt: p.item.scheduledAt },
          defsBySlug.get(p.item.campaignSlug),
        );
      }
      await store.saveEnrollments(enrollments);
      if (!state.firstSendAt) {
        state.firstSendAt = new Date().toISOString();
        await store.saveState(state);
      }
    }
  }

  const porCampanha = new Map<string, number>();
  for (const s of confirmed) porCampanha.set(s.campaignSlug, (porCampanha.get(s.campaignSlug) ?? 0) + 1);
  console.log(`✓ ${confirmed.length} e-mail(s) agendados no Resend (goteo até o fim da janela):`);
  for (const [slug, n] of porCampanha) console.log(`    ${slug}: ${n}`);
  console.log("  Acompanhe: pnpm outbound:sync · pnpm outbound:report · /interno/outbound (pnpm dev)");
  logger.info("outbound.send", {
    sends: confirmed.length,
    campaigns: [...porCampanha.keys()],
    capUsed: plan.capInfo.usedToday + confirmed.length,
  });
}

runExclusive("send", main).catch((err) => {
  console.error(`✖ send falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
