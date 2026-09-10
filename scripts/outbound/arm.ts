/**
 * `pnpm outbound:arm <status|arm|disarm|reset-breaker>` — chave geral da automação
 * (PRD §20: nenhum disparo automático sem ação explícita do usuário).
 *
 * - status                    estado (armado, breaker, caps, presença de env — sem valores)
 * - arm --confirm             ARMA os disparos automáticos (outbound:auto passa a enviar)
 * - disarm                    desarma
 * - reset-breaker --confirm   religa o circuit breaker global após investigação humana
 */
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { getOutboundEnv, rampCap } from "../../src/lib/outbound/config";
import type { OutboundEnv } from "../../src/lib/outbound/config";
import { openStore, runExclusive } from "../../src/lib/outbound/store";

const ENV_NAMES = [
  "OUTBOUND_RESEND_API_KEY",
  "OUTBOUND_FROM",
  "OUTBOUND_REPLY_TO",
  "OUTBOUND_DAILY_CAP",
  "OUTBOUND_SEND_WINDOW",
  "OUTBOUND_STORE_DIR",
];

function presenca(nome: string): string {
  return process.env[nome]?.trim() ? "presente" : "ausente";
}

function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function fmtWindow(env: OutboundEnv): string {
  return `${fmtMin(env.window.startMin)}-${fmtMin(env.window.endMin)}`;
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
    options: { confirm: { type: "boolean", default: false } },
    strict: true,
  });
  const cmd = positionals[0] ?? "status";
  const store = openStore();
  const state = await store.state();
  const now = new Date();

  if (cmd === "status") {
    const env = getOutboundEnv();
    console.log("Dreamy Outbound — estado da automação");
    console.log(`  armada:          ${state.armed ? `SIM (desde ${state.armedAt ?? "?"})` : "não"}`);
    console.log(`  primeiro envio:  ${state.firstSendAt ?? "— (rampa no dia 0)"}`);
    console.log(
      state.breakerTrippedAt
        ? `  breaker global:  DISPARADO em ${state.breakerTrippedAt} (${state.breakerReason ?? "sem motivo registrado"})`
        : "  breaker global:  ok",
    );
    console.log(`  cap por rampa:   ${rampCap(state.firstSendAt, now)}/dia (PRD §17: 15 → 30 → 50 → 80)`);
    console.log(
      `  cap override:    ${state.dailyCapOverride ?? "—"} (estado) · ${env.dailyCapEnv ?? "—"} (env OUTBOUND_DAILY_CAP)`,
    );
    console.log(`  janela de envio: ${fmtWindow(env)} (${env.utcOffset})`);
    console.log("  env (presença, sem valores):");
    for (const nome of ENV_NAMES) {
      if (nome === "OUTBOUND_REPLY_TO" && env.replyToError) {
        console.log(`    ${nome}: INVÁLIDA (${env.replyToError})`);
      } else if (nome === "OUTBOUND_REPLY_TO" && env.replyToAll.length > 0) {
        const n = env.replyToAll.length;
        console.log(`    ${nome}: presente (${n} ${n === 1 ? "endereço" : "endereços"} de resposta)`);
      } else {
        console.log(`    ${nome}: ${presenca(nome)}`);
      }
    }
    return;
  }

  if (cmd === "arm") {
    if (!values.confirm) {
      console.error("✖ Armar a automação exige --confirm.");
      console.error(
        "  Armada, a tarefa agendada (install-schedule.ps1) roda `pnpm outbound:auto` em dias úteis às 09:05",
      );
      console.error("  e ENVIA E-MAIL REAL sem confirmação por sessão, dentro de caps/janela/guard-rails.");
      process.exit(1);
    }
    state.armed = true;
    state.armedAt = new Date().toISOString();
    await store.saveState(state);
    console.log("✓ Automação ARMADA.");
    console.log("  A partir de agora, `pnpm outbound:auto` (tarefa agendada em dias úteis, 09:05):");
    console.log("  - sincroniza eventos com o Resend e aplica guard-rails (bounce/complaint);");
    console.log(
      "  - planeja e DISPARA e-mails reais respeitando rampa, cap diário, janela, supressão e aprovação de copy;",
    );
    console.log("  - para sozinho se o circuit breaker disparar (religar exige reset-breaker manual).");
    console.log("  Desarme a qualquer momento com: pnpm outbound:arm disarm");
    if (state.breakerTrippedAt) {
      console.log(
        "  ⚠ Breaker global está DISPARADO — nada será enviado até pnpm outbound:arm reset-breaker --confirm.",
      );
    }
    logger.info("outbound.arm", { armed: true });
    return;
  }

  if (cmd === "disarm") {
    state.armed = false;
    delete state.armedAt;
    await store.saveState(state);
    console.log("✓ Automação desarmada — `pnpm outbound:auto` deixa de disparar qualquer envio.");
    logger.info("outbound.arm", { armed: false });
    return;
  }

  if (cmd === "reset-breaker") {
    if (!state.breakerTrippedAt) {
      console.log("Breaker global não está disparado — nada a fazer.");
      return;
    }
    if (!values.confirm) {
      console.error(
        `✖ reset-breaker exige --confirm. Breaker disparado em ${state.breakerTrippedAt} (${state.breakerReason ?? "sem motivo registrado"}).`,
      );
      console.error("  Religue somente após investigação humana (PRD §21): causa identificada e corrigida.");
      process.exit(1);
    }
    const trippedAt = state.breakerTrippedAt;
    delete state.breakerTrippedAt;
    delete state.breakerReason;
    await store.saveState(state);
    console.log(`✓ Breaker global religado (estava disparado desde ${trippedAt}).`);
    console.log("  Lembrete: sends cancelados pelo breaker não voltam sozinhos — replaneje com outbound:plan.");
    logger.info("outbound.breaker_reset", { trippedAt });
    return;
  }

  console.error(`✖ Subcomando desconhecido: "${cmd}". Use: status | arm | disarm | reset-breaker.`);
  process.exit(1);
}

runExclusive("arm", main).catch((err) => {
  console.error(`✖ arm falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
