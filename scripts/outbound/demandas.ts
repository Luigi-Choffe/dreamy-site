/**
 * `pnpm outbound:demandas <list|add|claim|done|recusar>` — fila de demandas do MORK (PRD §29).
 * O time pede pelo console (/interno/outbound/demandas); o MORK consome aqui, no mesmo store.
 *
 *   list [--status <s>]
 *   add --title "..." [--kind copy|leads|analise|resposta|operacao|outra] [--details "..."] [--alta]
 *   claim --id <id>
 *   done --id <id> --resolution "..."
 *   recusar --id <id> --motivo "..."
 */
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { logAgentActivity } from "../../src/lib/outbound/agent-log";
import { applyDemandTransition, buildDemand, DEMAND_KINDS } from "../../src/lib/outbound/demands-core";
import { openStore, runExclusive } from "../../src/lib/outbound/store";
import type { Demand, DemandKind, DemandStatus } from "../../src/lib/outbound/types";

const STATUS_ORDER: DemandStatus[] = ["pendente", "em_andamento", "concluida", "recusada", "cancelada"];

function uso(): never {
  console.error(
    [
      "Uso: pnpm outbound:demandas <comando>",
      "  list [--status <pendente|em_andamento|concluida|recusada|cancelada>]",
      '  add --title "..." [--kind <tipo>] [--details "..."] [--alta]',
      "  claim --id <id>",
      '  done --id <id> --resolution "..."',
      '  recusar --id <id> --motivo "..."',
    ].join("\n"),
  );
  process.exit(1);
}

function findDemand(demands: Demand[], ref: string): Demand {
  const demand = demands.find((d) => d.id === ref || d.id.startsWith(ref));
  if (!demand) {
    console.error(`✖ Demanda "${ref}" não encontrada (veja: pnpm outbound:demandas list).`);
    process.exit(1);
  }
  return demand;
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      status: { type: "string" },
      title: { type: "string" },
      kind: { type: "string", default: "outra" },
      details: { type: "string" },
      alta: { type: "boolean", default: false },
      id: { type: "string" },
      resolution: { type: "string" },
      motivo: { type: "string" },
    },
    strict: true,
  });
  const cmd = positionals[0] ?? "list";
  const store = openStore();

  if (cmd === "list") {
    const demands = await store.demands();
    const filter = values.status as DemandStatus | undefined;
    if (filter && !STATUS_ORDER.includes(filter)) {
      console.error(`✖ --status inválido: "${filter}".`);
      process.exit(1);
    }
    console.log(`Fila de demandas (${demands.length})`);
    for (const status of STATUS_ORDER) {
      if (filter && status !== filter) continue;
      const list = demands.filter((d) => d.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (list.length === 0) continue;
      console.log(`\n  ${status} (${list.length})`);
      for (const d of list) {
        const alta = d.priority === "alta" ? " [ALTA]" : "";
        console.log(`    ${d.id.slice(0, 8)}  [${d.kind}]${alta} ${d.title} (por ${d.createdBy})`);
        if (d.details) console.log(`              ${d.details}`);
        if (d.resolution) console.log(`              resolução: ${d.resolution}`);
      }
    }
    if (demands.length === 0) console.log("  (vazia — o time cria em /interno/outbound/demandas)");
    return;
  }

  if (cmd === "add") {
    if (!values.title) uso();
    const kind = values.kind as DemandKind;
    if (!DEMAND_KINDS.includes(kind)) {
      console.error(`✖ --kind inválido: "${values.kind}". Válidos: ${DEMAND_KINDS.join(", ")}.`);
      process.exit(1);
    }
    const demand = buildDemand({
      title: values.title,
      details: values.details,
      kind,
      priority: values.alta ? "alta" : "normal",
      createdBy: "mork",
    });
    const demands = await store.demands();
    demands.push(demand);
    await store.saveDemands(demands);
    console.log(`✓ Demanda ${demand.id.slice(0, 8)} criada (${demand.status}).`);
    logger.info("outbound.demand.create", { demandId: demand.id, cli: true });
    return;
  }

  if (cmd === "claim" || cmd === "done" || cmd === "recusar") {
    if (!values.id) uso();
    const demands = await store.demands();
    const demand = findDemand(demands, values.id);
    if (cmd === "claim") {
      applyDemandTransition(demand, { to: "em_andamento", by: "mork" });
    } else if (cmd === "done") {
      if (!values.resolution) uso();
      applyDemandTransition(demand, { to: "concluida", by: "mork", resolution: values.resolution });
    } else {
      if (!values.motivo) uso();
      applyDemandTransition(demand, { to: "recusada", by: "mork", resolution: values.motivo });
    }
    await store.saveDemands(demands);
    await logAgentActivity(store, {
      actor: "mork",
      kind: "demanda",
      summary:
        cmd === "claim"
          ? `Assumiu a demanda: ${demand.title}`
          : cmd === "done"
            ? `Concluiu a demanda: ${demand.title} (${demand.resolution})`
            : `Recusou a demanda: ${demand.title} (${demand.resolution})`,
      refs: { demandId: demand.id, campaignSlug: demand.campaignSlug, contactId: demand.contactId },
    });
    console.log(`✓ Demanda ${demand.id.slice(0, 8)} agora está "${demand.status}".`);
    logger.info("outbound.demand.transition", { demandId: demand.id, status: demand.status, cli: true });
    return;
  }

  uso();
}

runExclusive("demandas", main).catch((err) => {
  console.error(`✖ demandas falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
