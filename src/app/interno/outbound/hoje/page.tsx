import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/outbound/auth";
import { getOutboundEnv, sendDateKey } from "@/lib/outbound/config";
import { nextBusinessDay, pendingFollowUps } from "@/lib/outbound/crm-core";
import type { Contact, CrmTask } from "@/lib/outbound/types";
import { completeTaskAction, createTaskAction, rescheduleTaskAction } from "../crm-actions";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConsoleShell } from "../shell";
import { Chip, ContactCell, EmptyState, fmtInt } from "../ui";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hoje · outbound · interno",
  robots: { index: false, follow: false },
};

const BTN =
  "rounded-md border border-border bg-background-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:border-border-strong";
const SECTION_TITLE = "font-display text-h4 font-bold";

function dueLabel(dateKey: string): string {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

function TaskRow({
  task,
  contact,
  isDemo,
  todayKey,
  reagendas,
}: {
  task: CrmTask;
  contact?: Contact;
  isDemo: boolean;
  todayKey: string;
  reagendas: Array<{ label: string; date: string }>;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-2.5 first:border-t-0">
      <span className="text-xs whitespace-nowrap text-foreground-subtle tabular-nums">{dueLabel(task.dueDate)}</span>
      {task.dueDate < todayKey ? <Chip tone="error">vencida</Chip> : null}
      {task.origin === "regra" ? <Chip tone="brand">regra</Chip> : null}
      <span className="min-w-0 flex-1 text-small font-medium text-foreground">{task.titulo}</span>
      {contact ? (
        <Link
          href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
          className="text-xs text-foreground-muted underline-offset-2 hover:text-brand-strong hover:underline"
        >
          <ContactCell contact={contact} />
        </Link>
      ) : null}
      <span className="flex flex-wrap items-center gap-1.5">
        <form action={completeTaskAction} className="inline">
          <input type="hidden" name="taskId" value={task.id} />
          {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <button type="submit" className={BTN}>
            Concluir
          </button>
        </form>
        {reagendas.map((r) => (
          <form key={r.date} action={rescheduleTaskAction} className="inline">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="dueDate" value={r.date} />
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <button type="submit" className={BTN} title={`Reagendar para ${r.date}`}>
              {r.label}
            </button>
          </form>
        ))}
      </span>
    </li>
  );
}

/** Mesa de trabalho do dia: o que vence, quem respondeu e ficou sem follow-up, o que vem. */
export default async function OutboundTodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const now = new Date();
  const off = getOutboundEnv().utcOffset;
  const todayKey = sendDateKey(now, off);
  const weekKey = sendDateKey(new Date(now.getTime() + 7 * 86_400_000), off);

  const contactById = new Map(data.contacts.map((c) => [c.id, c]));
  const open = data.tasks.filter((t) => t.status === "aberta").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueNow = open.filter((t) => t.dueDate <= todayKey);
  const upcoming = open.filter((t) => t.dueDate > todayKey && t.dueDate <= weekKey);

  const followUps = pendingFollowUps(data.replies, data.tasks)
    .map((reply) => ({ reply, contact: contactById.get(reply.contactId) }))
    .filter((f) => f.contact);

  const d1 = nextBusinessDay(now, off);
  const d3 = nextBusinessDay(new Date(now.getTime() + 2 * 86_400_000), off);
  const semana = nextBusinessDay(new Date(now.getTime() + 6 * 86_400_000), off);
  const reagendas = [
    { label: `+1d (${dueLabel(d1)})`, date: d1 },
    { label: `+3d (${dueLabel(d3)})`, date: d3 },
    { label: `semana (${dueLabel(semana)})`, date: semana },
  ];

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="hoje"
      data={data}
      title="Hoje"
      subtitle="A mesa do dia: tarefas vencendo, interessados sem follow-up e o que vem na semana."
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="hoje-vencidas-title">
          <h2 id="hoje-vencidas-title" className={SECTION_TITLE}>
            Para hoje ({fmtInt(dueNow.length)})
          </h2>
          {dueNow.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Nada para hoje. Tarefas novas nascem aqui, na conta do contato ou pelo MORK.</EmptyState>
            </div>
          ) : (
            <ol className="mt-3 rounded-lg border border-border bg-surface">
              {dueNow.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  contact={task.contactId ? contactById.get(task.contactId) : undefined}
                  isDemo={isDemo}
                  todayKey={todayKey}
                  reagendas={reagendas}
                />
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="hoje-followup-title">
          <h2 id="hoje-followup-title" className={SECTION_TITLE}>
            Interessados sem follow-up ({fmtInt(followUps.length)})
          </h2>
          <p className="mt-1 text-xs text-foreground-subtle">
            Responderam com interesse e ainda não têm tarefa aberta. Interessado sem resposta esfria rápido.
          </p>
          {followUps.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Todo interessado tem follow-up. É assim que se joga.</EmptyState>
            </div>
          ) : (
            <ol className="mt-3 rounded-lg border border-border bg-surface">
              {followUps.map(({ reply, contact }) => (
                <li
                  key={reply.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-2.5 first:border-t-0"
                >
                  <Chip tone="success">interessado</Chip>
                  <Link
                    href={consoleHref(`/interno/outbound/contatos/${contact!.id}`, isDemo)}
                    className="min-w-0 flex-1 underline-offset-2 hover:text-brand-strong hover:underline"
                  >
                    <ContactCell contact={contact!} />
                  </Link>
                  {reply.notes ? (
                    <span className="min-w-0 truncate text-xs text-foreground-subtle" title={reply.notes}>
                      {reply.notes}
                    </span>
                  ) : null}
                  <form action={createTaskAction}>
                    <input type="hidden" name="contactId" value={contact!.id} />
                    <input type="hidden" name="titulo" value="Responder e propor reunião" />
                    <input type="hidden" name="dueDate" value={d1} />
                    {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                    <button type="submit" className={BTN}>
                      Criar tarefa de reunião
                    </button>
                  </form>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="hoje-semana-title">
          <h2 id="hoje-semana-title" className={SECTION_TITLE}>
            Próximos 7 dias ({fmtInt(upcoming.length)})
          </h2>
          {upcoming.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Semana livre por enquanto.</EmptyState>
            </div>
          ) : (
            <ol className="mt-3 rounded-lg border border-border bg-surface">
              {upcoming.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  contact={task.contactId ? contactById.get(task.contactId) : undefined}
                  isDemo={isDemo}
                  todayKey={todayKey}
                  reagendas={reagendas}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
