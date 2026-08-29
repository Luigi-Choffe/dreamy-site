/**
 * `pnpm outbound:reply` — registra manualmente uma resposta recebida na caixa
 * monitorada (V1 do PRD §14). Para a sequência do contato (exceto `ooo`) e, com
 * `--suppress`, trata o pedido de "não quero receber" como opt-out no mesmo dia
 * (PRD §15).
 *
 * Uso:
 *   pnpm outbound:reply --email maria@empresa.com.br --class interested
 *   pnpm outbound:reply --email x@y.com.br --class negative --suppress --notes "pediu remoção"
 */
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { cancelScheduledSends } from "../../src/lib/outbound/cancel";
import { getOutboundEnv } from "../../src/lib/outbound/config";
import { applyOptOut, applyReply } from "../../src/lib/outbound/ops-core";
import type { ApplyReplyResult } from "../../src/lib/outbound/ops-core";
import { createResendClient } from "../../src/lib/outbound/resend";
import { openStore, runExclusive } from "../../src/lib/outbound/store";
import type { CampaignDefinition, ReplyClass } from "../../src/lib/outbound/types";

const CLASSES: ReplyClass[] = ["interested", "not_now", "referral", "negative", "ooo", "other"];

function uso(): never {
  console.error(
    'Uso: pnpm outbound:reply --email <e-mail> --class <interested|not_now|referral|negative|ooo|other> [--notes "..."] [--suppress] [--date <ISO>] [--campaign <slug>]',
  );
  process.exit(1);
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
      email: { type: "string" },
      class: { type: "string" },
      notes: { type: "string" },
      suppress: { type: "boolean", default: false },
      date: { type: "string" },
      campaign: { type: "string" },
    },
    strict: true,
  });
  if (!values.email || !values.class) uso();
  const classification = values.class as ReplyClass;
  if (!CLASSES.includes(classification)) {
    console.error(`✖ --class inválido: "${values.class}". Válidos: ${CLASSES.join(", ")}.`);
    process.exit(1);
  }
  let receivedAt = new Date().toISOString();
  if (values.date) {
    const parsed = new Date(values.date);
    if (Number.isNaN(parsed.getTime())) {
      console.error(`✖ --date inválida: "${values.date}" (use ISO, ex.: 2026-08-27T14:30:00-03:00).`);
      process.exit(1);
    }
    receivedAt = parsed.toISOString();
  }

  const store = openStore();
  const contact = await store.contactByEmail(values.email);
  if (!contact) {
    console.error(
      `✖ Nenhum contato com esse e-mail no store (${store.dir}). Confira o endereço ou importe a lista antes (pnpm outbound:import).`,
    );
    process.exit(1);
  }

  const enrollments = await store.enrollments();
  let result: ApplyReplyResult;
  try {
    result = applyReply({
      contact,
      enrollments,
      classification,
      notes: values.notes,
      receivedAt,
      campaignSlug: values.campaign,
    });
  } catch (err) {
    console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const replies = await store.replies();
  replies.push(result.reply);
  await store.saveReplies(replies);

  let finalEnrollments = result.enrollments;
  let paradosPorOptOut = 0;
  if (values.suppress) {
    // Pedido de remoção via resposta = opt-out no mesmo dia (PRD §15) — global e permanente.
    const optOut = applyOptOut(finalEnrollments, contact.id);
    finalEnrollments = optOut.enrollments;
    paradosPorOptOut = optOut.stoppedEnrollmentIds.length;
    await store.suppress({ email: contact.email, reason: "unsubscribe", origin: result.campaignSlug });
    const contacts = await store.contacts();
    const stored = contacts.find((c) => c.id === contact.id);
    if (stored && stored.status !== "suppressed") {
      stored.status = "suppressed";
      await store.saveContacts(contacts);
    }
  }
  await store.saveEnrollments(finalEnrollments);

  // Sends já AGENDADOS no Resend para este contato precisam ser cancelados — parar o
  // enrollment não desfaz um scheduled_at que já está na fila do provedor (PRD §15:
  // opt-out/resposta param a sequência IMEDIATAMENTE, inclusive o que está a caminho).
  // Exceção: ooo PURO não para a sequência (PRD §14) — cancelar aqui furaria um passo
  // que o enrollment considera enviado; ooo COM --suppress é opt-out e cancela sim.
  const sends = await store.sends();
  const deveCancelar = classification !== "ooo" || values.suppress;
  const pendentes = deveCancelar
    ? sends.filter((s) => s.contactId === contact.id && s.status === "scheduled")
    : [];
  let cancelados = 0;
  let cancelFalhas = 0;
  if (pendentes.length > 0) {
    const env = getOutboundEnv();
    if (!env.apiKey) {
      console.error(
        `⚠ ${pendentes.length} e-mail(s) deste contato JÁ AGENDADOS no Resend não puderam ser cancelados (OUTBOUND_RESEND_API_KEY ausente) — cancele no painel do Resend ou defina a chave e rode o reply de novo.`,
      );
    } else {
      const client = createResendClient(env.apiKey);
      const r = await cancelScheduledSends(client, store, {
        sends,
        enrollments: finalEnrollments,
        defsBySlug: new Map<string, CampaignDefinition>(),
        match: (s) => s.contactId === contact.id,
        motivo: values.suppress ? "opt-out do contato" : "contato respondeu",
        now: new Date(),
        rewind: false, // a sequência parou de vez — não há passo a reexecutar
      });
      cancelados = r.canceled;
      cancelFalhas = r.failures;
      await store.saveSends(sends);
    }
  }

  console.log("Resposta registrada");
  console.log(`  campanha:      ${result.campaignSlug}`);
  console.log(
    `  classificação: ${classification}${classification === "interested" ? " (vira reunião — métrica norte)" : ""}`,
  );
  if (classification === "ooo") {
    console.log("  sequência:     continua — ooo não conta como resposta real (PRD §14)");
  } else {
    console.log(`  sequência:     ${result.stoppedEnrollmentIds.length} enrollment(s) parado(s) por resposta`);
  }
  if (values.suppress) {
    console.log(`  supressão:     adicionada (unsubscribe) — ${paradosPorOptOut} enrollment(s) extra parado(s)`);
  }
  if (cancelados > 0 || cancelFalhas > 0) {
    console.log(`  agendados:     ${cancelados} cancelado(s) no Resend${cancelFalhas > 0 ? ` · ${cancelFalhas} FALHA(S) — cancele no painel` : ""}`);
  }

  logger.info("outbound.reply", {
    contactId: contact.id,
    campaignSlug: result.campaignSlug,
    classification,
    paradosPorResposta: result.stoppedEnrollmentIds.length,
    paradosPorOptOut,
    suprimido: Boolean(values.suppress),
    agendadosCancelados: cancelados,
    cancelFalhas,
  });
  if (cancelFalhas > 0) process.exit(1);
}

runExclusive("reply", main).catch((err) => {
  console.error(`✖ reply falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
