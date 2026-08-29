"use server";

import { revalidatePath } from "next/cache";
import { IS_PRODUCTION_SITE } from "@/config/env";
import { campaigns } from "@/content/outbound";
import { logger } from "@/lib/observability/logger";
import { cancelScheduledSends } from "@/lib/outbound/cancel";
import { getOutboundEnv } from "@/lib/outbound/config";
import { applyOptOut, applyReply } from "@/lib/outbound/ops-core";
import { createResendClient, type ResendClient } from "@/lib/outbound/resend";
import { openStore, runExclusive, type OutboundStore } from "@/lib/outbound/store";
import type { ReplyClass } from "@/lib/outbound/types";
import { demoDir } from "./data";

/**
 * Server Actions do console — SOMENTE operações conservadoras (PRD §16): pausar/
 * retomar campanha, registrar/classificar resposta, suprimir contato, desarmar.
 * Armar e disparar continuam EXCLUSIVOS da CLI (gates do §20/ADR-020).
 *
 * Toda action revalida o gate local (actions são alcançáveis por POST direto) e
 * roda sob o lock do store (mesma serialização dos CLIs). Em modo demo, opera no
 * store `.outbound-demo/` e NUNCA toca a API do Resend.
 */

const REPLY_CLASSES: ReadonlySet<string> = new Set([
  "interested",
  "not_now",
  "referral",
  "negative",
  "ooo",
  "other",
]);

interface ActionContext {
  store: OutboundStore;
  isDemo: boolean;
  /**
   * null = sem cancelamento remoto (demo, ou env sem OUTBOUND_RESEND_API_KEY).
   * Sem chave, sends já agendados NÃO são cancelados — eles aparecem como
   * "agendados órfãos" no fio de saúde do console (orphanScheduled) até serem
   * cancelados no painel do Resend ou pela ação repetida com a chave presente.
   */
  client: ResendClient | null;
}

function assertLocalConsole(): void {
  // V1 local: em produção o console nem renderiza (notFound) e as actions recusam.
  if (IS_PRODUCTION_SITE) throw new Error("Console indisponível em produção (PRD §16 — fase de deploy terá auth).");
}

async function withContext<T>(formData: FormData, label: string, fn: (ctx: ActionContext) => Promise<T>): Promise<T> {
  assertLocalConsole();
  const isDemo = formData.get("demo") === "1";
  const dir = isDemo ? demoDir() : undefined;
  return runExclusive(
    label,
    async () => {
      const store = dir ? openStore(dir) : openStore();
      const env = getOutboundEnv();
      const client = !isDemo && env.apiKey ? createResendClient(env.apiKey) : null;
      // Demo usa client null: cancelamento só local é correto ali (nenhum e-mail real).
      const result = await fn({ store, isDemo, client });
      revalidatePath("/interno/outbound", "layout");
      return result;
    },
    dir,
  );
}

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Campo obrigatório ausente: ${name}.`);
  return value.trim();
}

const defsBySlug = () => new Map(campaigns.map((d) => [d.slug, d]));

export async function pauseCampaignAction(formData: FormData): Promise<void> {
  const slug = requiredString(formData, "slug");
  const reason = (formData.get("reason") as string | null)?.trim() || "pausa pelo console";
  await withContext(formData, "console-pause", async ({ store, isDemo, client }) => {
    const runtimes = await store.campaignRuntimes();
    const known = campaigns.some((d) => d.slug === slug) || runtimes.some((r) => r.slug === slug);
    if (!known) throw new Error(`Campanha "${slug}" não existe.`);
    let runtime = runtimes.find((r) => r.slug === slug);
    if (!runtime) {
      runtime = { slug };
      runtimes.push(runtime);
    }
    if (!runtime.pausedAt) {
      runtime.pausedAt = new Date().toISOString();
      runtime.pausedReason = reason;
      await store.saveCampaignRuntimes(runtimes);
    }
    // Pausa de verdade cancela o que já está na fila (mesmo comportamento da CLI).
    const sends = await store.sends();
    const agendados = sends.filter((s) => s.campaignSlug === slug && s.status === "scheduled");
    if (agendados.length > 0 && (client || isDemo)) {
      const enrollments = await store.enrollments();
      await cancelScheduledSends(client, store, {
        sends,
        enrollments,
        defsBySlug: defsBySlug(),
        match: (s) => s.campaignSlug === slug,
        motivo: `pausa pelo console`,
        now: new Date(),
      });
      await store.saveSends(sends);
      await store.saveEnrollments(enrollments);
    }
    logger.info("outbound.console.pause", { slug, isDemo, agendados: agendados.length, apiCancel: Boolean(client) });
  });
}

export async function resumeCampaignAction(formData: FormData): Promise<void> {
  const slug = requiredString(formData, "slug");
  await withContext(formData, "console-resume", async ({ store, isDemo }) => {
    const runtimes = await store.campaignRuntimes();
    const runtime = runtimes.find((r) => r.slug === slug);
    if (!runtime?.pausedAt) return;
    delete runtime.pausedAt;
    delete runtime.pausedReason;
    await store.saveCampaignRuntimes(runtimes);
    logger.info("outbound.console.resume", { slug, isDemo });
  });
}

export async function suppressContactAction(formData: FormData): Promise<void> {
  const contactId = requiredString(formData, "contactId");
  await withContext(formData, "console-suppress", async ({ store, isDemo, client }) => {
    const contacts = await store.contacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new Error("Contato não encontrado.");
    await store.suppress({ email: contact.email, reason: "manual", origin: "console" });
    if (contact.status !== "suppressed") {
      contact.status = "suppressed";
      await store.saveContacts(contacts);
    }
    const enrollments = await store.enrollments();
    const { enrollments: updated } = applyOptOut(enrollments, contact.id);
    await store.saveEnrollments(updated);
    const sends = await store.sends();
    if (client || isDemo) {
      await cancelScheduledSends(client, store, {
        sends,
        enrollments: updated,
        defsBySlug: defsBySlug(),
        match: (s) => s.contactId === contact.id,
        motivo: "supressão pelo console",
        now: new Date(),
        rewind: false,
      });
      await store.saveSends(sends);
      await store.saveEnrollments(updated);
    }
    logger.info("outbound.console.suppress", { contactId, isDemo, apiCancel: Boolean(client) });
  });
}

export async function registerReplyAction(formData: FormData): Promise<void> {
  const contactId = requiredString(formData, "contactId");
  const classification = requiredString(formData, "classification");
  if (!REPLY_CLASSES.has(classification)) throw new Error(`Classificação inválida: ${classification}.`);
  const notes = (formData.get("notes") as string | null)?.trim() || undefined;
  const suppress = formData.get("suppress") === "1";
  await withContext(formData, "console-reply", async ({ store, isDemo, client }) => {
    const contacts = await store.contacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new Error("Contato não encontrado.");
    const enrollments = await store.enrollments();
    const result = applyReply({
      contact,
      enrollments,
      classification: classification as ReplyClass,
      notes,
      receivedAt: new Date().toISOString(),
    });
    const replies = await store.replies();
    replies.push(result.reply);
    await store.saveReplies(replies);

    let finalEnrollments = result.enrollments;
    if (suppress) {
      finalEnrollments = applyOptOut(finalEnrollments, contact.id).enrollments;
      await store.suppress({ email: contact.email, reason: "unsubscribe", origin: result.campaignSlug });
      if (contact.status !== "suppressed") {
        contact.status = "suppressed";
        await store.saveContacts(contacts);
      }
    }
    await store.saveEnrollments(finalEnrollments);

    const sends = await store.sends();
    // ooo puro não para a sequência (não cancela nada); ooo COM opt-out cancela sim —
    // "me removam" dentro de um auto-reply de férias é opt-out como qualquer outro (PRD §15).
    if ((client || isDemo) && (classification !== "ooo" || suppress)) {
      await cancelScheduledSends(client, store, {
        sends,
        enrollments: finalEnrollments,
        defsBySlug: defsBySlug(),
        match: (s) => s.contactId === contact.id,
        motivo: suppress ? "opt-out do contato" : "contato respondeu",
        now: new Date(),
        rewind: false,
      });
      await store.saveSends(sends);
      await store.saveEnrollments(finalEnrollments);
    }
    logger.info("outbound.console.reply", { contactId, classification, suppress, isDemo });
  });
}

export async function classifyReplyAction(formData: FormData): Promise<void> {
  const replyId = requiredString(formData, "replyId");
  const classification = requiredString(formData, "classification");
  if (!REPLY_CLASSES.has(classification)) throw new Error(`Classificação inválida: ${classification}.`);
  await withContext(formData, "console-classify", async ({ store, isDemo, client }) => {
    const replies = await store.replies();
    const reply = replies.find((r) => r.id === replyId);
    if (!reply) throw new Error("Resposta não encontrada.");
    const wasOoo = reply.classification === "ooo";
    reply.classification = classification as ReplyClass;
    await store.saveReplies(replies);

    // Reclassificar ooo → classe real significa "afinal, foi resposta de verdade":
    // aplicar os mesmos efeitos do registro — parar a sequência e cancelar agendados.
    // (O caminho inverso, real → ooo, NÃO ressuscita a sequência: religar é decisão
    // humana via enroll, nunca efeito colateral de classificação.)
    if (wasOoo && classification !== "ooo") {
      const enrollments = await store.enrollments();
      let stopped = 0;
      for (const enrollment of enrollments) {
        if (enrollment.contactId === reply.contactId && enrollment.status === "active") {
          enrollment.status = "replied";
          enrollment.stopReason = "reply";
          stopped += 1;
        }
      }
      await store.saveEnrollments(enrollments);
      if (client || isDemo) {
        const sends = await store.sends();
        await cancelScheduledSends(client, store, {
          sends,
          enrollments,
          defsBySlug: defsBySlug(),
          match: (s) => s.contactId === reply.contactId,
          motivo: "resposta reclassificada (era fora do escritório)",
          now: new Date(),
          rewind: false,
        });
        await store.saveSends(sends);
        await store.saveEnrollments(enrollments);
      }
      logger.info("outbound.console.classify", { replyId, classification, isDemo, reclassifiedFromOoo: true, stopped });
      return;
    }
    logger.info("outbound.console.classify", { replyId, classification, isDemo });
  });
}

/** Desarmar é sempre seguro pelo console. ARMAR continua só na CLI (ADR-020). */
export async function disarmAction(formData: FormData): Promise<void> {
  await withContext(formData, "console-disarm", async ({ store, isDemo }) => {
    const state = await store.state();
    if (!state.armed) return;
    state.armed = false;
    delete state.armedAt;
    await store.saveState(state);
    logger.info("outbound.console.disarm", { isDemo });
  });
}
