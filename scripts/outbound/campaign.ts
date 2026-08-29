/**
 * `pnpm outbound:campaign <list|approve|pause|resume|enroll>` — gestão de campanhas.
 *
 * Definições (copy versionada) vivem no registry `src/content/outbound/index.ts`
 * (`campaigns: CampaignDefinition[]`); o estado runtime (aprovação, pausa) vive no
 * store local (`.outbound/campaigns.json`) — copy é conteúdo, aprovação é operação.
 *
 * - list                                       definições + runtime + guard-rails
 * - approve --slug X --by "nome" --confirm     gate de copy (lint em todos os passos)
 * - pause   --slug X [--reason "..."]          pausa manual
 * - resume  --slug X                           retoma (NÃO religa o breaker global)
 * - enroll  --slug X [--limit N] [--industry "..."] [--dry-run]
 */
import { parseArgs } from "node:util";
import { campaigns } from "../../src/content/outbound";
import { logger } from "../../src/lib/observability/logger";
import { cancelScheduledSends } from "../../src/lib/outbound/cancel";
import { getOutboundEnv } from "../../src/lib/outbound/config";
import { evaluateGuardRails } from "../../src/lib/outbound/guardrails";
import { buildEnrollment, normalizeIndustria, selectEnrollmentCandidates } from "../../src/lib/outbound/ops-core";
import { campaignContentHash, lintEmail, renderTemplate } from "../../src/lib/outbound/render";
import { createResendClient } from "../../src/lib/outbound/resend";
import { openStore, runExclusive } from "../../src/lib/outbound/store";
import type { CampaignDefinition } from "../../src/lib/outbound/types";

/**
 * Variáveis de amostra do approve (custom vazio). Toda variável de template fora
 * desta lista precisa vir de coluna custom do import — ausência aqui é ERRO.
 */
const SAMPLE_VARS: Record<string, string> = { nome: "Maria", empresa: "Acme", cargo: "CEO", industria: "exemplo" };

interface Flags {
  slug?: string;
  by?: string;
  confirm: boolean;
  reason?: string;
  industry?: string;
  limit?: string;
  dryRun: boolean;
}

function loadDefinitions(): CampaignDefinition[] {
  return [...campaigns].sort((a, b) => a.slug.localeCompare(b.slug));
}

function requireSlug(flags: Flags): string {
  if (!flags.slug) {
    console.error("✖ Informe --slug <campanha>.");
    process.exit(1);
  }
  return flags.slug;
}

function findDefinition(slug: string): CampaignDefinition {
  const defs = loadDefinitions();
  const def = defs.find((d) => d.slug === slug);
  if (!def) {
    console.error(
      `✖ Campanha "${slug}" não registrada em src/content/outbound/index.ts (${defs.length} definição(ões): ${defs.map((d) => d.slug).join(", ") || "nenhuma"}).`,
    );
    process.exit(1);
  }
  return def;
}

function printTable(header: string[], rows: string[][]) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const fmt = (cells: string[]) => cells.map((c, i) => (c ?? "").padEnd(widths[i]!)).join("  ");
  console.log(fmt(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(fmt(row));
}

async function cmdList() {
  const store = openStore();
  const defs = loadDefinitions();
  const [runtimes, sends] = await Promise.all([store.campaignRuntimes(), store.sends()]);
  const state = await store.state();
  const runtimeBySlug = new Map(runtimes.map((r) => [r.slug, r]));

  if (defs.length === 0) {
    console.log("Nenhuma campanha registrada em src/content/outbound/index.ts (array `campaigns`).");
  } else {
    const rows = defs.map((def) => {
      const runtime = runtimeBySlug.get(def.slug);
      const rails = evaluateGuardRails(sends, def.slug);
      return [
        def.slug,
        def.industria,
        def.anchor,
        `${def.status} (${def.steps.length} passos)`,
        runtime?.approvedAt ? `sim (${runtime.approvedAt.slice(0, 10)}, ${runtime.approvedBy ?? "?"})` : "não",
        runtime?.pausedAt ? `sim (${runtime.pausedReason ?? "?"})` : "não",
        String(rails.sent),
        `${rails.bounced} (${(rails.bounceRate * 100).toFixed(1)}%)${rails.bounceTripped ? " ⚠" : ""}`,
        String(rails.complained),
      ];
    });
    printTable(["campanha", "indústria", "âncora", "def", "aprovada", "pausada", "envios", "bounce", "compl."], rows);
  }

  const orfaos = runtimes.filter((r) => !defs.some((d) => d.slug === r.slug));
  if (orfaos.length > 0) console.log(`Runtime sem definição: ${orfaos.map((r) => r.slug).join(", ")}`);
  console.log("");
  console.log(
    state.breakerTrippedAt
      ? `Breaker global: DISPARADO em ${state.breakerTrippedAt} (${state.breakerReason ?? "sem motivo registrado"})`
      : "Breaker global: ok",
  );
  console.log(`Automação: ${state.armed ? "ARMADA" : "desarmada"}`);
}

async function cmdApprove(flags: Flags) {
  const slug = requireSlug(flags);
  if (!flags.by) {
    console.error('✖ Informe --by "nome de quem aprova" (aprovação é registrada — PRD §20).');
    process.exit(1);
  }
  if (!flags.confirm) {
    console.error("✖ Aprovação exige --confirm (gate de copy do PRD §20).");
    process.exit(1);
  }
  const def = findDefinition(slug);
  if (def.status !== "ready") {
    console.error(
      `✖ Definição está "${def.status}" — só campanhas "ready" podem ser aprovadas. Finalize a copy antes.`,
    );
    process.exit(1);
  }

  const problemas: string[] = [];
  const avisos: string[] = [];
  // sampleCustom da definição cobre variáveis de enriquecimento ({{abertura}} etc.);
  // no envio real a variável precisa existir no contato (o motor bloqueia se faltar).
  const sampleVars = { ...SAMPLE_VARS, ...def.sampleCustom };
  for (const step of def.steps) {
    const subject = renderTemplate(step.subject, sampleVars);
    const body = renderTemplate(step.body, sampleVars);
    const ausentes = [...new Set([...subject.missing, ...body.missing])];
    for (const nome of ausentes) {
      problemas.push(
        `${step.id}: variável {{${nome}}} sem valor de amostra — se é coluna custom do Clay, garanta a coluna no import; se é typo, corrija o template.`,
      );
    }
    if (ausentes.length > 0) continue; // lint sobre texto com buraco só geraria ruído
    for (const issue of lintEmail(subject.value, body.value, { subjectTemplate: step.subject })) {
      const linha = `${step.id}: [${issue.rule}] ${issue.detail}`;
      if (issue.level === "error") problemas.push(linha);
      else avisos.push(linha);
    }
  }
  if (avisos.length > 0) {
    console.log("Avisos de lint (não bloqueiam, pedem revisão):");
    for (const aviso of avisos) console.log(`  - ${aviso}`);
  }
  if (problemas.length > 0) {
    console.error(`✖ Aprovação recusada — ${problemas.length} erro(s) de lint:`);
    for (const problema of problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }

  const store = openStore();
  const runtimes = await store.campaignRuntimes();
  let runtime = runtimes.find((r) => r.slug === slug);
  if (!runtime) {
    runtime = { slug };
    runtimes.push(runtime);
  }
  runtime.approvedAt = new Date().toISOString();
  runtime.approvedBy = flags.by;
  // A aprovação vale para ESTE conteúdo: copy editada depois invalida (o motor compara o hash).
  runtime.approvedHash = campaignContentHash(def);
  await store.saveCampaignRuntimes(runtimes);
  console.log(
    `✓ Campanha "${slug}" aprovada por ${flags.by} em ${runtime.approvedAt} (${def.steps.length} passos lintados, hash ${runtime.approvedHash}).`,
  );
  console.log("  Editar a copy depois disto invalida a aprovação — o motor exigirá novo approve.");
  logger.info("outbound.campaign.approve", { slug, passos: def.steps.length, hash: runtime.approvedHash });
}

/** Pause/resume atuam sobre campanha conhecida: definição no registry OU runtime já existente
 *  (órfã). Slug com typo tem de FALHAR — pausa é freio de emergência (achado da revisão). */
function requireKnownSlug(slug: string, runtimes: Array<{ slug: string }>): void {
  const defs = loadDefinitions();
  if (defs.some((d) => d.slug === slug) || runtimes.some((r) => r.slug === slug)) return;
  console.error(
    `✖ Campanha "${slug}" não existe nem no registry nem no store. Registradas: ${
      defs.map((d) => d.slug).join(", ") || "nenhuma"
    }.`,
  );
  process.exit(1);
}

async function cmdPause(flags: Flags) {
  const slug = requireSlug(flags);
  const store = openStore();
  const runtimes = await store.campaignRuntimes();
  requireKnownSlug(slug, runtimes);
  let runtime = runtimes.find((r) => r.slug === slug);
  if (!runtime) {
    runtime = { slug };
    runtimes.push(runtime);
  }
  if (runtime.pausedAt) {
    console.log(
      `Campanha "${slug}" já está pausada desde ${runtime.pausedAt} (${runtime.pausedReason ?? "sem motivo"}).`,
    );
    return;
  }
  runtime.pausedAt = new Date().toISOString();
  runtime.pausedReason = flags.reason ?? "manual";
  await store.saveCampaignRuntimes(runtimes);
  console.log(`✓ Campanha "${slug}" pausada (${runtime.pausedReason}).`);

  // Pausar também cancela o que JÁ está agendado no Resend — pausa que deixa a fila
  // do dia sair não é freio (achado da revisão; mesmo comportamento do sync).
  const sends = await store.sends();
  const agendados = sends.filter((s) => s.campaignSlug === slug && s.status === "scheduled");
  if (agendados.length > 0) {
    const env = getOutboundEnv();
    if (!env.apiKey) {
      console.error(
        `⚠ ${agendados.length} e-mail(s) da campanha JÁ AGENDADOS no Resend não puderam ser cancelados (OUTBOUND_RESEND_API_KEY ausente) — cancele no painel ou defina a chave e rode o pause de novo.`,
      );
    } else {
      const enrollments = await store.enrollments();
      const r = await cancelScheduledSends(createResendClient(env.apiKey), store, {
        sends,
        enrollments,
        defsBySlug: new Map(loadDefinitions().map((d) => [d.slug, d])),
        match: (s) => s.campaignSlug === slug,
        motivo: `pausa manual da campanha ${slug}`,
        now: new Date(),
      });
      await store.saveSends(sends);
      await store.saveEnrollments(enrollments);
      console.log(
        `  agendados cancelados: ${r.canceled} · enrollments rebobinados: ${r.rewound}${r.failures > 0 ? ` · FALHAS: ${r.failures} (cancele no painel)` : ""}`,
      );
      if (r.failures > 0) process.exitCode = 1;
    }
  }
  logger.info("outbound.campaign.pause", { slug, reason: runtime.pausedReason, agendados: agendados.length });
}

async function cmdResume(flags: Flags) {
  const slug = requireSlug(flags);
  const store = openStore();
  const runtimes = await store.campaignRuntimes();
  requireKnownSlug(slug, runtimes);
  const runtime = runtimes.find((r) => r.slug === slug);
  if (!runtime?.pausedAt) {
    console.log(`Campanha "${slug}" não está pausada — nada a fazer.`);
    return;
  }
  delete runtime.pausedAt;
  delete runtime.pausedReason;
  await store.saveCampaignRuntimes(runtimes);
  console.log(`✓ Campanha "${slug}" retomada.`);
  const state = await store.state();
  if (state.breakerTrippedAt) {
    console.log(
      `⚠ Breaker GLOBAL continua disparado (${state.breakerReason ?? "?"}) — resume não religa; investigue e use pnpm outbound:arm reset-breaker --confirm.`,
    );
  }
  logger.info("outbound.campaign.resume", { slug });
}

async function cmdEnroll(flags: Flags) {
  const slug = requireSlug(flags);
  const def = findDefinition(slug);
  let limit: number | undefined;
  if (flags.limit !== undefined) {
    limit = Number(flags.limit);
    if (!Number.isInteger(limit) || limit <= 0) {
      console.error(`✖ --limit inválido: "${flags.limit}" (inteiro > 0).`);
      process.exit(1);
    }
  }
  const industria = flags.industry ?? def.industria;

  const store = openStore();
  const [contacts, enrollments, suppressions, runtimes] = await Promise.all([
    store.contacts(),
    store.enrollments(),
    store.suppressions(),
    store.campaignRuntimes(),
  ]);
  const suppressed = new Set(suppressions.map((s) => s.email));
  const selection = selectEnrollmentCandidates({
    contacts,
    enrollments,
    suppressed,
    campaignSlug: slug,
    industria,
    limit,
  });

  console.log(
    `Enroll — campanha "${slug}" · indústria alvo "${industria}" (normalizada: "${normalizeIndustria(industria)}")`,
  );
  console.log(`  contatos no store:         ${contacts.length}`);
  console.log(`  elegíveis:                 ${selection.eligible.length}`);
  const skipped = selection.skipped;
  console.log(`  fora (status ≠ active):    ${skipped.statusNaoAtivo}`);
  console.log(`  fora (verificação ≠ ok):   ${skipped.verificacaoNaoOk}`);
  console.log(`  fora (outra indústria):    ${skipped.industriaDiferente}`);
  console.log(`  fora (suprimido):          ${skipped.suprimido}`);
  console.log(`  fora (já nesta campanha):  ${skipped.jaNaCampanha}`);
  console.log(`  fora (ativo em outra):     ${skipped.ativoEmOutraCampanha}`);
  if (limit !== undefined) console.log(`  fora (além do --limit):    ${skipped.alemDoLimite}`);

  const runtime = runtimes.find((r) => r.slug === slug);
  if (!runtime?.approvedAt) {
    console.log("  ⚠ campanha ainda NÃO aprovada — enroll não envia nada, mas o envio fica bloqueado até o approve.");
  }

  if (flags.dryRun) {
    console.log("Dry-run: nenhum enrollment gravado.");
    return;
  }
  if (selection.eligible.length === 0) {
    console.log("Nenhum contato elegível — nada gravado.");
    return;
  }

  const now = new Date();
  for (const contact of selection.eligible) enrollments.push(buildEnrollment(contact, slug, now));
  await store.saveEnrollments(enrollments);
  console.log(`✓ ${selection.eligible.length} enrollment(s) criado(s) para "${slug}".`);
  logger.info("outbound.campaign.enroll", { slug, criados: selection.eligible.length, skipped });
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      slug: { type: "string" },
      by: { type: "string" },
      confirm: { type: "boolean", default: false },
      reason: { type: "string" },
      industry: { type: "string" },
      limit: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });
  const flags: Flags = {
    slug: values.slug,
    by: values.by,
    confirm: values.confirm ?? false,
    reason: values.reason,
    industry: values.industry,
    limit: values.limit,
    dryRun: values["dry-run"] ?? false,
  };
  const cmd = positionals[0] ?? "list";
  switch (cmd) {
    case "list":
      return cmdList();
    case "approve":
      return cmdApprove(flags);
    case "pause":
      return cmdPause(flags);
    case "resume":
      return cmdResume(flags);
    case "enroll":
      return cmdEnroll(flags);
    default:
      console.error(`✖ Subcomando desconhecido: "${cmd}". Use: list | approve | pause | resume | enroll.`);
      process.exit(1);
  }
}

runExclusive("campaign", main).catch((err) => {
  console.error(`✖ campaign falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
