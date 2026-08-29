/**
 * `pnpm outbound:auto [--dry-run]` — ciclo diário da automação (rodado pela tarefa
 * agendada de scripts/outbound/install-schedule.ps1, dias úteis 09:05).
 *
 * Sequência: sync (eventos/guard-rails) → plan → send --confirm --yes (só se armada
 * e sem breaker) → report. Qualquer passo com erro interrompe o ciclo (exit 1).
 */
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { openStore } from "../../src/lib/outbound/store";

function run(label: string, script: string, args: string[] = []): number {
  console.log(`\n── outbound:auto · ${label} ──`);
  const cmd = ["pnpm", "tsx", `scripts/outbound/${script}`, ...args].join(" ");
  const res = spawnSync(cmd, { cwd: process.cwd(), stdio: "inherit", shell: true });
  return res.status ?? 1;
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { "dry-run": { type: "boolean", default: false } },
    strict: true,
  });
  const dryRun = values["dry-run"];
  logger.info("outbound.auto.start", { dryRun });

  const syncStatus = run("sincronizar eventos", "sync.ts");
  if (syncStatus !== 0) {
    console.error("✖ auto interrompido: sync falhou (eventos/guard-rails desatualizados — não é seguro enviar).");
    process.exit(1);
  }

  const planStatus = run("plano do dia", "plan.ts");
  if (planStatus !== 0) {
    console.error("✖ auto interrompido: plan falhou.");
    process.exit(1);
  }

  const store = openStore();
  const state = await store.state();
  if (dryRun) {
    console.log("\n── outbound:auto · envio PULADO (--dry-run) ──");
  } else if (!state.armed) {
    console.log("\n── outbound:auto · envio PULADO: automação desarmada (pnpm outbound:arm arm --confirm) ──");
  } else if (state.breakerTrippedAt) {
    console.log(
      `\n── outbound:auto · envio PULADO: breaker global disparado em ${state.breakerTrippedAt} (${state.breakerReason ?? "?"}) ──`,
    );
  } else {
    const sendStatus = run("disparo", "send.ts", ["--confirm", "--yes"]);
    if (sendStatus !== 0) {
      console.error("✖ auto interrompido: send falhou.");
      process.exit(1);
    }
  }

  const reportStatus = run("relatório", "report.ts");
  if (reportStatus !== 0) {
    console.error("✖ auto: report falhou (envio do dia não foi afetado).");
    process.exit(1);
  }
  logger.info("outbound.auto.done", { dryRun, armed: state.armed });
}

main().catch((err) => {
  console.error(`✖ auto falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
