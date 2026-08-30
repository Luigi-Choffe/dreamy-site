/**
 * `pnpm outbound:crm <reconcile|list|move>` — pipeline de negócios (CRM piloto, PRD §29).
 *
 *   reconcile                      deriva/avança negócios a partir do outbound (idempotente)
 *   list [--stage <estagio>]       negócios por estágio (sem e-mails no terminal)
 *   move <dealId|contactId> <estagio> [--valor N] [--motivo "..."] [--reuniao <ISO>]
 *
 * Mover negócio NÃO pausa nem cancela e-mail (isso é outbound:reply/campaign/arm).
 */
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { getOutboundEnv, sendDateKey } from "../../src/lib/outbound/config";
import { applyStageMove, DEAL_STAGES, nextBusinessDay, reconcileDeals } from "../../src/lib/outbound/crm-core";
import { newId, openStore, runExclusive } from "../../src/lib/outbound/store";
import type { DealStage } from "../../src/lib/outbound/types";

function uso(): never {
  console.error(
    [
      "Uso: pnpm outbound:crm <comando>",
      "  reconcile",
      "  list [--stage <estagio>]",
      '  move <dealId|contactId> <estagio> [--valor N] [--motivo "..."] [--reuniao <ISO>]',
      '  task list [--today] | task add --titulo "..." [--contact <id>] [--due AAAA-MM-DD] | task done --id <id>',
      '  note add --contact <id> --texto "..."',
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      stage: { type: "string" },
      valor: { type: "string" },
      motivo: { type: "string" },
      reuniao: { type: "string" },
      contact: { type: "string" },
      titulo: { type: "string" },
      due: { type: "string" },
      id: { type: "string" },
      texto: { type: "string" },
      today: { type: "boolean", default: false },
    },
    strict: true,
  });
  const cmd = positionals[0];
  const store = openStore();

  if (cmd === "reconcile") {
    const [contacts, enrollments, sends, replies, deals] = await Promise.all([
      store.contacts(),
      store.enrollments(),
      store.sends(),
      store.replies(),
      store.deals(),
    ]);
    const result = reconcileDeals({ contacts, enrollments, sends, replies, deals });
    if (result.created > 0 || result.advanced > 0) {
      await store.saveDeals(result.deals);
      const activities = await store.agentActivities();
      activities.push({
        id: newId(),
        actor: "mork",
        kind: "crm",
        summary: `Pipeline sincronizado: ${result.created} negócio(s) criado(s), ${result.advanced} avançado(s).`,
        at: new Date().toISOString(),
      });
      await store.saveAgentActivities(activities);
    }
    console.log(`✓ Pipeline sincronizado: ${result.created} criado(s), ${result.advanced} avançado(s).`);
    logger.info("outbound.crm.reconcile", { created: result.created, advanced: result.advanced, cli: true });
    return;
  }

  if (cmd === "list") {
    const [deals, contacts] = await Promise.all([store.deals(), store.contacts()]);
    const contactById = new Map(contacts.map((c) => [c.id, c]));
    const filter = values.stage as DealStage | undefined;
    if (filter && !DEAL_STAGES.includes(filter)) {
      console.error(`✖ --stage inválido: "${filter}". Válidos: ${DEAL_STAGES.join(", ")}.`);
      process.exit(1);
    }
    console.log("Pipeline de negócios");
    for (const stage of DEAL_STAGES) {
      if (filter && stage !== filter) continue;
      const list = deals.filter((d) => d.stage === stage);
      if (list.length === 0 && filter === undefined) continue;
      console.log(`\n  ${stage} (${list.length})`);
      for (const deal of list) {
        const contact = contactById.get(deal.contactId);
        const nome = contact ? [contact.nome, contact.sobrenome].filter(Boolean).join(" ") : "(contato removido)";
        const valor = deal.valorEstimado ? ` · R$ ${deal.valorEstimado.toLocaleString("pt-BR")}` : "";
        console.log(
          `    ${deal.id.slice(0, 8)}  ${(deal.empresa ?? nome).padEnd(32).slice(0, 32)} ${nome.padEnd(24).slice(0, 24)} ${deal.campaignSlug ?? "manual"}${valor}`,
        );
      }
    }
    if (deals.length === 0) console.log("  (vazio — rode: pnpm outbound:crm reconcile)");
    return;
  }

  if (cmd === "move") {
    const ref = positionals[1];
    const to = positionals[2] as DealStage | undefined;
    if (!ref || !to) uso();
    if (!DEAL_STAGES.includes(to)) {
      console.error(`✖ Estágio inválido: "${to}". Válidos: ${DEAL_STAGES.join(", ")}.`);
      process.exit(1);
    }
    const deals = await store.deals();
    const deal = deals.find((d) => d.id === ref || d.id.startsWith(ref) || d.contactId === ref);
    if (!deal) {
      console.error(`✖ Nenhum negócio com id/contactId "${ref}" (veja: pnpm outbound:crm list).`);
      process.exit(1);
    }
    let valor: number | undefined;
    if (values.valor !== undefined) {
      valor = Number(values.valor);
      if (!Number.isFinite(valor) || valor < 0) {
        console.error(`✖ --valor inválido: "${values.valor}".`);
        process.exit(1);
      }
    }
    const changed = applyStageMove(deal, {
      to,
      by: "mork",
      motivo: values.motivo,
      reuniaoEm: values.reuniao,
      valorEstimado: valor,
    });
    if (changed || valor !== undefined) await store.saveDeals(deals);
    console.log(changed ? `✓ Negócio ${deal.id.slice(0, 8)} movido para "${to}".` : "Nada a mudar (mesmo estágio).");
    logger.info("outbound.crm.move", { dealId: deal.id, stage: to, changed, cli: true });
    return;
  }

  if (cmd === "task") {
    const sub = positionals[1] ?? "list";
    const off = getOutboundEnv().utcOffset;
    if (sub === "list") {
      const [tasks, contacts] = await Promise.all([store.tasks(), store.contacts()]);
      const contactById = new Map(contacts.map((c) => [c.id, c]));
      const today = sendDateKey(new Date(), off);
      const open = tasks
        .filter((t) => t.status === "aberta")
        .filter((t) => (values.today ? t.dueDate <= today : true))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      console.log(values.today ? `Tarefas de hoje/vencidas (${open.length})` : `Tarefas abertas (${open.length})`);
      for (const t of open) {
        const c = t.contactId ? contactById.get(t.contactId) : undefined;
        const nome = c ? [c.nome, c.sobrenome].filter(Boolean).join(" ") : "";
        const atraso = t.dueDate < today ? " · VENCIDA" : "";
        console.log(`  ${t.id.slice(0, 8)}  ${t.dueDate}${atraso}  ${t.titulo}${nome ? ` (${nome})` : ""}`);
      }
      if (open.length === 0) console.log("  (nada por aqui)");
      return;
    }
    if (sub === "add") {
      if (!values.titulo) uso();
      if (values.due && !/^\d{4}-\d{2}-\d{2}$/.test(values.due)) {
        console.error(`✖ --due inválida: "${values.due}" (use AAAA-MM-DD).`);
        process.exit(1);
      }
      if (values.contact) {
        const contacts = await store.contacts();
        if (!contacts.some((c) => c.id === values.contact)) {
          console.error(`✖ Contato "${values.contact}" não existe.`);
          process.exit(1);
        }
      }
      const tasks = await store.tasks();
      const task = {
        id: newId(),
        titulo: values.titulo,
        contactId: values.contact,
        dueDate: values.due ?? nextBusinessDay(new Date(), off),
        status: "aberta" as const,
        origin: "manual" as const,
        createdBy: "mork",
        createdAt: new Date().toISOString(),
      };
      tasks.push(task);
      await store.saveTasks(tasks);
      console.log(`✓ Tarefa ${task.id.slice(0, 8)} criada para ${task.dueDate}.`);
      logger.info("outbound.crm.task.create", { taskId: task.id, cli: true });
      return;
    }
    if (sub === "done") {
      if (!values.id) uso();
      const tasks = await store.tasks();
      const ref = values.id;
      const task = tasks.find((t) => t.id === ref || t.id.startsWith(ref));
      if (!task) {
        console.error(`✖ Tarefa "${ref}" não encontrada (veja: pnpm outbound:crm task list).`);
        process.exit(1);
      }
      if (task.status === "aberta") {
        task.status = "concluida";
        task.doneAt = new Date().toISOString();
        await store.saveTasks(tasks);
      }
      console.log(`✓ Tarefa ${task.id.slice(0, 8)} concluída.`);
      logger.info("outbound.crm.task.done", { taskId: task.id, cli: true });
      return;
    }
    uso();
  }

  if (cmd === "note") {
    if (positionals[1] !== "add" || !values.contact || !values.texto) uso();
    const contacts = await store.contacts();
    const contact = contacts.find((c) => c.id === values.contact);
    if (!contact) {
      console.error(`✖ Contato "${values.contact}" não existe.`);
      process.exit(1);
    }
    const deal = (await store.deals()).find((d) => d.contactId === contact.id);
    const notes = await store.notes();
    notes.push({
      id: newId(),
      contactId: contact.id,
      dealId: deal?.id,
      authorEmail: "mork",
      body: values.texto,
      origin: "manual" as const,
      createdAt: new Date().toISOString(),
    });
    await store.saveNotes(notes);
    console.log("✓ Nota registrada.");
    logger.info("outbound.crm.note", { contactId: contact.id, cli: true });
    return;
  }

  uso();
}

runExclusive("crm", main).catch((err) => {
  console.error(`✖ crm falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
