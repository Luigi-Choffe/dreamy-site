/**
 * `pnpm outbound:plan [--campaign <slug>] [--json]` — plano de envio do dia (PRD §12).
 * Só leitura: mostra o que `outbound:send` enviaria agora (cap, janela, cadência,
 * supressão, lint) e grava o snapshot em .outbound/plan-<YYYY-MM-DD>.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { campaigns } from "../../src/content/outbound";
import { getOutboundEnv, sendDateKey } from "../../src/lib/outbound/config";
import { computePlan, type PlanResult } from "../../src/lib/outbound/engine";
import { openStore } from "../../src/lib/outbound/store";
import type { Contact } from "../../src/lib/outbound/types";

function hora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export async function buildPlan(campaignFilter?: string): Promise<PlanResult> {
  const store = openStore();
  const [contacts, enrollments, sends, suppressions, runtimes, state] = await Promise.all([
    store.contacts(),
    store.enrollments(),
    store.sends(),
    store.suppressions(),
    store.campaignRuntimes(),
    store.state(),
  ]);
  return computePlan({
    contacts,
    enrollments,
    sends,
    suppressions,
    campaignDefs: campaigns,
    runtimes,
    state,
    env: getOutboundEnv(),
    now: new Date(),
    campaignFilter,
  });
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
      json: { type: "boolean", default: false },
    },
    strict: true,
  });

  const env = getOutboundEnv();
  const store = openStore();
  const plan = await buildPlan(values.campaign);
  const contacts = await store.contacts();
  const byId = new Map<string, Contact>(contacts.map((c) => [c.id, c]));

  const snapshotFile = path.join(store.dir, `plan-${sendDateKey(new Date(), env.utcOffset)}.json`);
  await fs.mkdir(store.dir, { recursive: true });
  await fs.writeFile(
    snapshotFile,
    JSON.stringify({ generatedAt: new Date().toISOString(), ...plan }, null, 2) + "\n",
    "utf8",
  );

  if (values.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log("Dreamy Outbound — plano do dia");
  console.log(
    `  cap: ${plan.capInfo.cap}/dia · usados hoje: ${plan.capInfo.usedToday} · disponíveis: ${plan.capInfo.available}`,
  );
  if (plan.blockedReason) {
    console.log(`  BLOQUEADO: ${plan.blockedReason}`);
  } else if (plan.items.length === 0) {
    console.log("  Nenhum envio elegível agora (veja os motivos abaixo).");
  } else {
    console.log(`  ${plan.items.length} envio(s) planejado(s):`);
    for (const item of plan.items) {
      const c = byId.get(item.contactId);
      const quem = c ? `${c.nome}${c.empresa ? ` · ${c.empresa}` : ""}` : item.contactId;
      console.log(`    ${hora(item.scheduledAt)}  ${item.campaignSlug} ${item.stepId}  ${quem}`);
    }
  }

  if (plan.skipped.length > 0) {
    const porMotivo = new Map<string, number>();
    for (const s of plan.skipped) porMotivo.set(s.reason, (porMotivo.get(s.reason) ?? 0) + 1);
    console.log(`  Pulados (${plan.skipped.length}):`);
    for (const [reason, count] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(count).padStart(4)}×  ${reason}`);
    }
  }
  console.log(`  Snapshot: ${snapshotFile}`);
  logger.info("outbound.plan", {
    items: plan.items.length,
    skipped: plan.skipped.length,
    blocked: plan.blockedReason ?? null,
  });
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("outbound/plan.ts");
if (isDirectRun) {
  main().catch((err) => {
    console.error(`✖ plan falhou: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
