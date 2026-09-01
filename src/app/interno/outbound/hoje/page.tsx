import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/outbound/auth";
import { getOutboundEnv, sendDateKey } from "@/lib/outbound/config";
import { nextBusinessDay, pendingFollowUps } from "@/lib/outbound/crm-core";
import type { Contact, CrmTask } from "@/lib/outbound/types";
import { completeTaskAction, createTaskAction, rescheduleTaskAction } from "../crm-actions";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { PendingPill } from "../pending";
import { ConsoleShell } from "../shell";
import { Chip, ContactCell, EmptyState, MenuLinha, TituloSecao } from "../ui";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hoje · outbound · interno",
  robots: { index: false, follow: false },
};

/** Ação principal da linha em toque pequeno de verde; secundárias em ghost. */
const BTN_BASE =
  "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-(--duration-fast) ease-(--ease-out) " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98]";
const BTN_PRIMARY = `${BTN_BASE} bg-brand-soft text-brand-strong hover:bg-brand-soft-strong`;

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
    // Linha da casa (T3/R1): data · título+chips · contato · ações — as três datas
    // de reagendar pararam de se repetir como texto solto e moram no menu "adiar ▾".
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-4 py-2.5 transition-colors duration-(--duration-fast) first:border-t-0 even:bg-background-secondary/25 hover:bg-surface-hover sm:grid sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(10rem,14rem)_auto] sm:items-center">
      <span className="text-xs whitespace-nowrap text-foreground-subtle tabular-nums">{dueLabel(task.dueDate)}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="min-w-0 text-small font-medium text-foreground">{task.titulo}</span>
        {task.dueDate < todayKey ? <Chip tone="error">vencida</Chip> : null}
        {task.origin === "regra" ? <Chip tone="brand">regra</Chip> : null}
      </span>
      <span className="min-w-0 text-xs">
        {contact ? (
          <Link
            href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
            className="text-foreground-muted underline-offset-2 hover:text-brand-strong hover:underline"
          >
            <ContactCell contact={contact} />
          </Link>
        ) : null}
      </span>
      <span className="flex items-center gap-1.5 sm:justify-self-end">
        <form action={completeTaskAction} className="inline">
          <input type="hidden" name="taskId" value={task.id} />
          {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <PendingPill className={BTN_PRIMARY} pendingLabel="Concluindo…">
            Concluir
          </PendingPill>
        </form>
        <MenuLinha rotulo="Adiar a tarefa" gatilho="adiar">
          {reagendas.map((r) => (
            <form key={r.date} action={rescheduleTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="dueDate" value={r.date} />
              {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
              <PendingPill
                className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-foreground transition-colors duration-(--duration-fast) hover:bg-background-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                pendingLabel="Movendo…"
                title={`Reagendar para ${r.date}`}
              >
                {r.label} · {dueLabel(r.date)}
              </PendingPill>
            </form>
          ))}
        </MenuLinha>
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
    { label: "+1 dia útil", date: d1 },
    { label: "+3 dias", date: d3 },
    { label: "próxima semana", date: semana },
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
          <TituloSecao id="hoje-vencidas-title" contagem={dueNow.length}>
            Para hoje
          </TituloSecao>
          {dueNow.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Nada para hoje. Tarefas novas nascem aqui, na conta do contato ou pelo MORK.</EmptyState>
            </div>
          ) : (
            <ol className="mt-3 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
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
          <TituloSecao id="hoje-followup-title" contagem={followUps.length}>
            Interessados sem follow-up
          </TituloSecao>
          <p className="mt-1 text-xs text-foreground-subtle">
            Responderam com interesse e ainda não têm tarefa aberta. Interessado sem resposta esfria rápido.
          </p>
          {followUps.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Todo interessado tem follow-up. É assim que se joga.</EmptyState>
            </div>
          ) : (
            <ol className="mt-3 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              {followUps.map(({ reply, contact }) => (
                <li
                  key={reply.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-2.5 transition-colors duration-(--duration-fast) first:border-t-0 hover:bg-surface-hover"
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
                    <PendingPill className={BTN_PRIMARY} pendingLabel="Criando…">
                      Criar tarefa de reunião
                    </PendingPill>
                  </form>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="hoje-semana-title">
          <TituloSecao id="hoje-semana-title" contagem={upcoming.length}>
            Próximos 7 dias
          </TituloSecao>
          {upcoming.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Semana livre por enquanto.</EmptyState>
            </div>
          ) : (
            <ol className="mt-3 rounded-xl border border-dashed border-border bg-background-secondary/30">
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
