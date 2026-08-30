import { NextResponse, type NextRequest } from "next/server";
import { demoDir } from "@/app/interno/outbound/data";
import { campaigns } from "@/content/outbound";
import { logger } from "@/lib/observability/logger";
import { aiAvailable, aiModelLabel, generateBriefing, type BriefingAggregates } from "@/lib/outbound/ai";
import { logAgentActivity } from "@/lib/outbound/agent-log";
import { getSession } from "@/lib/outbound/auth";
import { getOutboundEnv, sendDateKey } from "@/lib/outbound/config";
import { dailyCap, usedTodayCount } from "@/lib/outbound/engine";
import { evaluateGuardRails } from "@/lib/outbound/guardrails";
import { meetingStats, wasSent } from "@/lib/outbound/metrics";
import { newId, openStore, runExclusive } from "@/lib/outbound/store";
import type { AiBriefing } from "@/lib/outbound/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/outbound/briefing — gera (ou regenera) o briefing executivo do dia.
 * Sessão obrigatória (o proxy é só a checagem otimista). Leitura sem lock; a
 * chamada à Anthropic fica FORA de qualquer lock; a gravação é curta e sob lock.
 * Sem OUTBOUND_ANTHROPIC_API_KEY: 503 com instrução. Em demo: conteúdo simulado,
 * rotulado, sem tocar API externa.
 */

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

const DEMO_BRIEFING = [
  "Dia bom para vender: 2 reuniões no radar (1 marcada para esta semana) e 1 proposta aberta de R$ 80 mil.",
  "O funil segue saudável: entregas altas, bounce controlado e 5 interessados acumulados.",
  "Risco do dia: 1 tarefa vencida de follow-up; interessado sem resposta esfria rápido.",
  "Ação mais importante: responder o interessado da construção e confirmar a reunião de quinta.",
  "(Conteúdo de demonstração, gerado sem IA.)",
].join(" ");

function view(briefing: AiBriefing) {
  return { content: briefing.content, generatedAt: briefing.generatedAt, model: briefing.model, demo: briefing.demo };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return json(401, { ok: false, code: "unauthorized" });

  const body = (await request.json().catch(() => null)) as { demo?: boolean } | null;
  const isDemo = body?.demo === true;
  const env = getOutboundEnv();
  const now = new Date();
  const dateKey = sendDateKey(now, env.utcOffset);
  const store = isDemo ? openStore(demoDir()) : openStore();

  if (isDemo) {
    const briefing: AiBriefing = {
      id: newId(),
      dateKey,
      generatedAt: now.toISOString(),
      generatedBy: "demo",
      model: "exemplo",
      demo: true,
      content: DEMO_BRIEFING,
    };
    await runExclusive(
      "briefing-demo",
      async () => {
        const rows = await store.briefings();
        const kept = rows.filter((b) => b.dateKey !== dateKey);
        kept.push(briefing);
        await store.saveBriefings(kept);
      },
      demoDir(),
    );
    return json(200, { ok: true, briefing: view(briefing) });
  }

  if (!aiAvailable()) {
    return json(503, {
      ok: false,
      code: "sem_chave",
      error:
        "Defina OUTBOUND_ANTHROPIC_API_KEY ou OUTBOUND_OPENAI_API_KEY (na Vercel e no .env.local do PC) para ligar o briefing por IA.",
    });
  }

  const [sends, replies, deals, tasks, demands, state] = await Promise.all([
    store.sends(),
    store.replies(),
    store.deals(),
    store.tasks(),
    store.demands(),
    store.state(),
  ]);
  const rails = evaluateGuardRails(sends);
  const meetings = meetingStats(deals, replies);
  const pipelineCounts = new Map<string, number>();
  for (const deal of deals) pipelineCounts.set(deal.stage, (pipelineCounts.get(deal.stage) ?? 0) + 1);

  const aggregates: BriefingAggregates = {
    dateKey,
    armada: state.armed,
    capDia: dailyCap(state, env, now),
    usadosHoje: usedTodayCount(sends, now, env.utcOffset),
    enviadosTotal: rails.sent,
    entreguesTotal: sends.filter((s) => s.status === "delivered").length,
    bounceRatePct: Math.round(rails.bounceRate * 1000) / 10,
    respostasReais: replies.filter((r) => r.classification !== "ooo").length,
    interessados: replies.filter((r) => r.classification === "interested").length,
    tarefasHojeOuVencidas: tasks.filter((t) => t.status === "aberta" && t.dueDate <= dateKey).length,
    demandasPendentes: demands.filter((d) => d.status === "pendente").length,
    reunioesMarcadas: meetings.geradas,
    reunioesRealizadas: meetings.realizadas,
    pipeline: [...pipelineCounts.entries()].map(([estagio, quantidade]) => ({ estagio, quantidade })),
    campanhas: campaigns.map((def) => {
      const campSends = sends.filter((s) => s.campaignSlug === def.slug);
      const campReplies = replies.filter((r) => r.campaignSlug === def.slug);
      return {
        industria: def.industria,
        enviados: campSends.filter(wasSent).length,
        respostas: campReplies.length,
        interessados: campReplies.filter((r) => r.classification === "interested").length,
      };
    }),
  };

  let content: string;
  try {
    content = await generateBriefing(aggregates);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar o briefing.";
    logger.warn("outbound.ai.briefing_falhou", { message });
    return json(502, { ok: false, code: "ia_falhou", error: message });
  }

  const briefing: AiBriefing = {
    id: newId(),
    dateKey,
    generatedAt: new Date().toISOString(),
    generatedBy: session.email,
    model: aiModelLabel(),
    content,
  };
  await runExclusive("briefing-save", async () => {
    const rows = await store.briefings();
    const kept = rows.filter((b) => b.dateKey !== dateKey);
    kept.push(briefing);
    await store.saveBriefings(kept);
    await logAgentActivity(store, {
      actor: "console",
      kind: "briefing",
      summary: `Briefing do dia ${dateKey} gerado.`,
    });
  });
  logger.info("outbound.ai.briefing", { dateKey });
  return json(200, { ok: true, briefing: view(briefing) });
}
