/**
 * `pnpm outbound:report [--json]` — relatório por campanha + estado global (PRD §21).
 * Hierarquia honesta de métricas: decisão por resposta/reunião; abertura sempre com
 * ressalva. Grava snapshot diário (contagens, sem PII) em
 * `.outbound/reports/report-<YYYY-MM-DD>.json`.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { getOutboundEnv, rampCap, sendDateKey } from "../../src/lib/outbound/config";
import { replyStepId } from "../../src/lib/outbound/ops-core";
import { openStore } from "../../src/lib/outbound/store";
import type { SendRecord } from "../../src/lib/outbound/types";

const NOTA_ABERTURA = "abertura é inflada por proxies (Apple MPP/Gmail) — decida por resposta/clique";

interface StepFunnel {
  step: string;
  enviados: number;
  entregues: number;
  respostas: number;
}

interface CampaignReport {
  campanha: string;
  enviados: number;
  entregues: number;
  bounces: number;
  /** Fração (0–1) sobre enviados. */
  bounceRate: number;
  complaints: number;
  abertos: number;
  cliques: number;
  respostas: Record<string, number>;
  /** Reuniões = respostas `interested` (métrica norte). */
  reunioes: number;
  descadastros: number;
  funil: StepFunnel[];
}

interface GlobalReport {
  armed: boolean;
  breakerTrippedAt: string | null;
  breakerReason: string | null;
  firstSendAt: string | null;
  capRampa: number;
  capOverride: number | null;
  capDoDia: number;
  supressoesPorMotivo: Record<string, number>;
  campanhasPausadas: Array<{ slug: string; reason: string | null }>;
}

interface OutboundReport {
  geradoEm: string;
  notaAbertura: string;
  global: GlobalReport;
  campanhas: CampaignReport[];
}

/** Saiu de verdade (conta no denominador): tudo que não é agendado/cancelado/falho. */
function foiEnviado(send: SendRecord): boolean {
  return send.status !== "scheduled" && send.status !== "canceled" && send.status !== "failed";
}

/** Chegou à caixa (complained foi entregue antes de ser reclamado). */
function foiEntregue(send: SendRecord): boolean {
  return send.status === "delivered" || send.status === "complained";
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function printHuman(report: OutboundReport) {
  console.log("Dreamy Outbound — relatório");
  console.log(`gerado em ${report.geradoEm}`);
  console.log("");
  if (report.campanhas.length === 0) console.log("Nenhuma campanha com atividade registrada.");
  for (const c of report.campanhas) {
    console.log(`Campanha ${c.campanha}`);
    console.log(
      `  enviados: ${c.enviados} · entregues: ${c.entregues} · bounce: ${c.bounces} (${pct(c.bounceRate)}) · complaint: ${c.complaints}`,
    );
    console.log(`  abertos*: ${c.abertos} · cliques: ${c.cliques} · descadastros: ${c.descadastros}`);
    const respostas =
      Object.entries(c.respostas)
        .map(([classe, n]) => `${classe}=${n}`)
        .join(" ") || "nenhuma";
    console.log(`  respostas: ${respostas} · reuniões (interested): ${c.reunioes}`);
    if (c.funil.length > 0) {
      console.log("  funil por passo (enviados / entregues / respostas):");
      for (const f of c.funil) console.log(`    ${f.step}: ${f.enviados} / ${f.entregues} / ${f.respostas}`);
    }
    console.log("");
  }
  console.log(`* ${NOTA_ABERTURA}`);
  console.log("");
  const g = report.global;
  console.log("Estado global");
  console.log(`  automação: ${g.armed ? "ARMADA" : "desarmada"}`);
  console.log(
    g.breakerTrippedAt
      ? `  breaker: DISPARADO em ${g.breakerTrippedAt} (${g.breakerReason ?? "sem motivo registrado"})`
      : "  breaker: ok",
  );
  console.log(
    `  cap do dia: ${g.capDoDia} (rampa ${g.capRampa}${g.capOverride !== null ? `, override ${g.capOverride}` : ""})`,
  );
  const supressoes =
    Object.entries(g.supressoesPorMotivo)
      .map(([motivo, n]) => `${motivo}=${n}`)
      .join(" ") || "nenhuma";
  console.log(`  supressões: ${supressoes}`);
  if (g.campanhasPausadas.length > 0) {
    console.log(`  campanhas pausadas: ${g.campanhasPausadas.map((p) => `${p.slug} (${p.reason ?? "?"})`).join(", ")}`);
  }
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { json: { type: "boolean", default: false } },
    strict: true,
  });

  const store = openStore();
  const [sends, enrollments, replies, suppressions, runtimes] = await Promise.all([
    store.sends(),
    store.enrollments(),
    store.replies(),
    store.suppressions(),
    store.campaignRuntimes(),
  ]);
  const state = await store.state();
  const env = getOutboundEnv();
  const now = new Date();

  const slugs = [
    ...new Set([
      ...sends.map((s) => s.campaignSlug),
      ...enrollments.map((e) => e.campaignSlug),
      ...replies.map((r) => r.campaignSlug),
    ]),
  ].sort();

  const campanhas: CampaignReport[] = slugs.map((slug) => {
    const cSends = sends.filter((s) => s.campaignSlug === slug);
    const cReplies = replies.filter((r) => r.campaignSlug === slug);
    const cEnrollments = enrollments.filter((e) => e.campaignSlug === slug);
    const enviados = cSends.filter(foiEnviado).length;
    const bounces = cSends.filter((s) => s.status === "bounced").length;
    const respostas: Record<string, number> = {};
    for (const reply of cReplies) respostas[reply.classification] = (respostas[reply.classification] ?? 0) + 1;
    const stepIds = [...new Set(cSends.map((s) => s.stepId))].sort();
    return {
      campanha: slug,
      enviados,
      entregues: cSends.filter(foiEntregue).length,
      bounces,
      bounceRate: enviados > 0 ? bounces / enviados : 0,
      complaints: cSends.filter((s) => s.status === "complained").length,
      abertos: cSends.filter((s) => s.opened).length,
      cliques: cSends.filter((s) => s.clicked).length,
      respostas,
      reunioes: respostas.interested ?? 0,
      descadastros: cEnrollments.filter((e) => e.stopReason === "unsubscribe").length,
      funil: stepIds.map((step) => ({
        step,
        enviados: cSends.filter((s) => s.stepId === step && foiEnviado(s)).length,
        entregues: cSends.filter((s) => s.stepId === step && foiEntregue(s)).length,
        respostas: cReplies.filter((r) => replyStepId(sends, r) === step).length,
      })),
    };
  });

  const supressoesPorMotivo: Record<string, number> = {};
  for (const s of suppressions) supressoesPorMotivo[s.reason] = (supressoesPorMotivo[s.reason] ?? 0) + 1;

  const capRampa = rampCap(state.firstSendAt, now);
  const capOverride = state.dailyCapOverride ?? env.dailyCapEnv ?? null;
  const report: OutboundReport = {
    geradoEm: now.toISOString(),
    notaAbertura: NOTA_ABERTURA,
    global: {
      armed: state.armed,
      breakerTrippedAt: state.breakerTrippedAt ?? null,
      breakerReason: state.breakerReason ?? null,
      firstSendAt: state.firstSendAt ?? null,
      capRampa,
      capOverride,
      capDoDia: Math.min(capRampa, capOverride ?? capRampa),
      supressoesPorMotivo,
      campanhasPausadas: runtimes
        .filter((r) => r.pausedAt)
        .map((r) => ({ slug: r.slug, reason: r.pausedReason ?? null })),
    },
    campanhas,
  };

  const reportsDir = path.join(store.dir, "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const fileName = `report-${sendDateKey(now, env.utcOffset)}.json`;
  const outPath = path.join(reportsDir, fileName);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  if (values.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  console.log("");
  console.log(`Snapshot gravado em ${path.relative(process.cwd(), outPath) || outPath}`);

  logger.info("outbound.report", { campanhas: campanhas.length, arquivo: fileName });
}

main().catch((err) => {
  console.error(`✖ report falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
