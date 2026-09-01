import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/outbound/auth";
import { buildAgenda } from "@/lib/outbound/agenda-core";
import { getOutboundEnv, sendDateKey } from "@/lib/outbound/config";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConsoleShell } from "../shell";
import { Chip, Code, ContactCell, DEAL_STAGE_LABELS, DEAL_STAGE_TONES, EmptyState, fmtInt, plural } from "../ui";

/** Sempre dinâmico: a previsão é recalculada a cada abertura. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda · outbound · interno",
  robots: { index: false, follow: false },
};

const HORIZON_DAYS = 10;

const horaFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});
const diaFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });

function tituloDoDia(dateKey: string, todayKey: string, amanhaKey: string): string {
  const ddmm = `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
  if (dateKey === todayKey) return `Hoje · ${ddmm}`;
  if (dateKey === amanhaKey) return `Amanhã · ${ddmm}`;
  const weekday = diaFmt.format(new Date(`${dateKey}T12:00:00-03:00`));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${ddmm}`;
}

/** Agenda: e-mails da cadência (previsão + fila real do Resend), tarefas e reuniões. */
export default async function OutboundAgendaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const env = getOutboundEnv();
  const now = new Date();
  const todayKey = sendDateKey(now, env.utcOffset);
  const amanhaKey = sendDateKey(new Date(now.getTime() + 86_400_000), env.utcOffset);

  const agenda = buildAgenda(
    {
      contacts: data.contacts,
      enrollments: data.enrollments,
      sends: data.sends,
      suppressions: data.suppressions,
      campaignDefs: data.defs,
      runtimes: data.runtimes,
      state: data.state,
      tasks: data.tasks,
      deals: data.deals,
      env,
      now,
    },
    HORIZON_DAYS,
  );
  const contactById = new Map(data.contacts.map((c) => [c.id, c]));
  const defsBySlug = new Map(data.defs.map((d) => [d.slug, d]));
  const totalPrevistos = agenda.days.reduce((sum, d) => sum + d.previstos.length + d.agendados.length, 0);

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="agenda"
      data={data}
      title="Agenda"
      subtitle="O futuro da operação: e-mails da cadência, fila do Resend, tarefas e reuniões, dia a dia."
    >
      <div className="flex flex-col gap-8">
        {agenda.blockedReason ? (
          <div className="rounded-lg border border-error/50 bg-error-soft px-4 py-3 text-small text-foreground">
            <span className="font-semibold text-error">Operação travada: </span>
            {agenda.blockedReason} Até resolver, nenhum envio sai e esta agenda não tem previsão.
          </div>
        ) : (
          <p className="text-xs text-foreground-subtle">
            E-mails com o ponto verde{" "}
            <span aria-hidden className="inline-block size-1.5 rounded-full bg-brand align-middle" /> já estão na fila
            do Resend com hora marcada de verdade. O restante (círculo vazado) é a{" "}
            <span className="font-semibold text-foreground">previsão da cadência</span> (mesma matemática do motor,
            recalculada agora): o disparo real decide às 09:05 de cada dia útil, e respostas, pausas ou supressões mudam
            o plano.{" "}
            {agenda.tarefasAtrasadas > 0 ? (
              <>
                Há{" "}
                <Link
                  href={consoleHref("/interno/outbound/hoje", isDemo)}
                  className="font-semibold text-warning underline underline-offset-2"
                >
                  {plural(agenda.tarefasAtrasadas, "tarefa vencida", "tarefas vencidas")}
                </Link>{" "}
                esperando na aba Hoje.
              </>
            ) : null}
          </p>
        )}

        {totalPrevistos === 0 && agenda.days.every((d) => d.tarefas.length === 0 && d.reunioes.length === 0) ? (
          <EmptyState>
            Nada no horizonte: sem sequências ativas com passos devidos, tarefas ou reuniões nos próximos dias. Inscreva
            contatos (<Code>pnpm outbound:campaign enroll</Code>) ou crie tarefas na aba Hoje.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-4">
            {agenda.days.map((day, index) => {
              const vazio =
                day.previstos.length === 0 &&
                day.agendados.length === 0 &&
                day.tarefas.length === 0 &&
                day.reunioes.length === 0;
              const isHoje = day.dateKey === todayKey;
              const emails = day.previstos.length + day.agendados.length;
              // Zeros são mudos (REDESIGN-CONSOLE, lei 4): só conta o que existe.
              const contagens = [
                emails > 0 ? plural(emails, "e-mail", "e-mails") : null,
                day.tarefas.length > 0 ? plural(day.tarefas.length, "tarefa") : null,
                day.reunioes.length > 0 ? plural(day.reunioes.length, "reunião", "reuniões") : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={day.dateKey}>
                  {/* Hoje é o centro de gravidade; dia vazio recua para linha fantasma. */}
                  <Card
                    as="section"
                    padding="sm"
                    aria-label={tituloDoDia(day.dateKey, todayKey, amanhaKey)}
                    className={
                      isHoje
                        ? "shadow-md ring-1 ring-brand-strong/15"
                        : vazio
                          ? "border-dashed bg-background-secondary/30 shadow-none"
                          : undefined
                    }
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 className="font-display text-h4 font-bold">
                        {isHoje ? (
                          <span
                            aria-hidden
                            className="pulse-live mr-2 inline-block size-1.5 -translate-y-[0.15em] rounded-full bg-brand"
                          />
                        ) : null}
                        {tituloDoDia(day.dateKey, todayKey, amanhaKey)}
                      </h2>
                      {contagens ? <p className="text-xs text-foreground-subtle tabular-nums">{contagens}</p> : null}
                    </div>

                    {vazio ? (
                      <p className="mt-2 text-small text-foreground-subtle">Dia livre na cadência.</p>
                    ) : (
                      <div className="mt-3 flex flex-col gap-3">
                        {day.reunioes.length > 0 ? (
                          <ul className="flex flex-col gap-1.5">
                            {day.reunioes.map((deal) => {
                              const contact = contactById.get(deal.contactId);
                              return (
                                <li key={deal.id} className="flex flex-wrap items-center gap-2 text-small">
                                  <Chip tone={DEAL_STAGE_TONES[deal.stage]}>{DEAL_STAGE_LABELS[deal.stage]}</Chip>
                                  <span className="font-semibold text-foreground tabular-nums">
                                    {deal.reuniaoEm ? horaFmt.format(new Date(deal.reuniaoEm)) : ""}
                                  </span>
                                  <span className="min-w-0 truncate">
                                    {contact ? (
                                      <Link
                                        href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
                                        className="underline-offset-2 hover:text-brand-strong hover:underline"
                                      >
                                        Reunião com {deal.empresa ?? contact.empresa ?? "(empresa)"}
                                        <span className="text-foreground-subtle">
                                          {" "}
                                          · {[contact.nome, contact.sobrenome].filter(Boolean).join(" ")}
                                        </span>
                                      </Link>
                                    ) : (
                                      <>Reunião com {deal.empresa ?? "(empresa)"}</>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}

                        {day.tarefas.length > 0 ? (
                          <ul className="flex flex-col gap-1.5">
                            {day.tarefas.map((task) => {
                              const contact = task.contactId ? contactById.get(task.contactId) : undefined;
                              return (
                                <li key={task.id} className="flex flex-wrap items-center gap-2 text-small">
                                  <Chip tone="warning">tarefa</Chip>
                                  <span className="min-w-0 truncate font-medium text-foreground">{task.titulo}</span>
                                  {contact ? (
                                    <Link
                                      href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
                                      className="text-xs text-foreground-muted underline-offset-2 hover:text-brand-strong hover:underline"
                                    >
                                      <ContactCell contact={contact} />
                                    </Link>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}

                        {day.agendados.length + day.previstos.length > 0 ? (
                          <details open={index < 2}>
                            <summary className="cursor-pointer text-small font-semibold text-brand-strong">
                              {plural(emails, "e-mail de campanha", "e-mails de campanha")}
                              {day.previstos.length > 0
                                ? ` (${day.agendados.length > 0 ? `${fmtInt(day.agendados.length)} na fila + ` : ""}${fmtInt(day.previstos.length)} previstos)`
                                : " na fila do Resend"}
                            </summary>
                            <ul className="mt-2 flex flex-col gap-1">
                              {day.agendados.map((send) => {
                                const contact = contactById.get(send.contactId);
                                return (
                                  <li key={send.id} className="flex flex-wrap items-center gap-2 text-small">
                                    <span
                                      aria-hidden
                                      title="na fila do Resend"
                                      className="size-1.5 shrink-0 rounded-full bg-brand"
                                    />
                                    <span className="w-12 shrink-0 font-semibold text-foreground tabular-nums">
                                      {send.scheduledAt ? horaFmt.format(new Date(send.scheduledAt)) : ""}
                                    </span>
                                    <span className="w-7 text-xs text-foreground-muted uppercase">{send.stepId}</span>
                                    {contact ? (
                                      <Link
                                        href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
                                        className="underline-offset-2 hover:text-brand-strong hover:underline"
                                      >
                                        <ContactCell contact={contact} />
                                      </Link>
                                    ) : (
                                      <span className="text-foreground-subtle">(contato)</span>
                                    )}
                                    <span className="sr-only">na fila do Resend</span>
                                  </li>
                                );
                              })}
                              {day.previstos.map((item) => {
                                const contact = contactById.get(item.contactId);
                                const def = defsBySlug.get(item.campaignSlug);
                                return (
                                  <li
                                    key={`${item.campaignSlug}-${item.contactId}-${item.stepId}`}
                                    className="flex flex-wrap items-center gap-2 text-small"
                                  >
                                    <span
                                      aria-hidden
                                      title="previsão da cadência"
                                      className="size-1.5 shrink-0 rounded-full border border-border-strong"
                                    />
                                    <span className="w-12 shrink-0 text-foreground-muted tabular-nums">
                                      {horaFmt.format(new Date(item.scheduledAt))}
                                    </span>
                                    <span className="w-7 text-xs text-foreground-muted uppercase">{item.stepId}</span>
                                    {contact ? (
                                      <Link
                                        href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
                                        className="underline-offset-2 hover:text-brand-strong hover:underline"
                                      >
                                        <ContactCell contact={contact} />
                                      </Link>
                                    ) : (
                                      <span className="text-foreground-subtle">(contato)</span>
                                    )}
                                    <span className="text-xs text-foreground-subtle" title={item.campaignSlug}>
                                      {def?.industria ?? item.campaignSlug}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </details>
                        ) : null}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </ConsoleShell>
  );
}
