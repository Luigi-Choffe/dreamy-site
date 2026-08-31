import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Field";
import { requireSession } from "@/lib/outbound/auth";
import { getOutboundEnv } from "@/lib/outbound/config";
import { buildAccountTimeline, nextBusinessDay, type TimelineItem } from "@/lib/outbound/crm-core";
import type { ReplyClass } from "@/lib/outbound/types";
import { registerReplyAction, suppressContactAction } from "../../actions";
import { addNoteAction, createTaskAction } from "../../crm-actions";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../../data";
import { ConsoleShell } from "../../shell";
import { Chip, DEAL_STAGE_LABELS, DEAL_STAGE_TONES, EmptyState, fmtDateTime, REPLY_CLASS_LABELS } from "../../ui";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conta · outbound · interno",
  robots: { index: false, follow: false },
};

const REPLY_CLASSES: ReplyClass[] = ["interested", "not_now", "referral", "negative", "ooo", "other"];

/**
 * Marcador por tipo na timeline: ponto colorido + rótulo pt-BR correto
 * (nada de enum cru na interface). Verde só no que vale ouro: a resposta.
 */
const TIMELINE_STYLE: Record<TimelineItem["kind"], { label: string; dot: string }> = {
  envio: { label: "envio", dot: "bg-border-strong" },
  evento: { label: "evento", dot: "bg-foreground-subtle" },
  resposta: { label: "resposta", dot: "bg-brand" },
  nota: { label: "nota", dot: "bg-foreground-subtle" },
  tarefa: { label: "tarefa", dot: "bg-warning" },
  estagio: { label: "estágio", dot: "bg-foreground" },
};

const CONTROL =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-small text-foreground " +
  "hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";
const LABEL = "text-xs font-semibold text-foreground";

/** Página da conta: timeline unificada, notas, tarefas e ações do contato. */
export default async function ContactAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);

  const contact = data.contacts.find((c) => c.id === id);
  if (!contact) notFound();

  const deal = data.deals.find((d) => d.contactId === contact.id);
  const enrollments = data.enrollments.filter((e) => e.contactId === contact.id);
  const openTasks = data.tasks.filter((t) => t.contactId === contact.id && t.status === "aberta");
  const timeline = buildAccountTimeline({
    contactId: contact.id,
    sends: data.sends,
    events: data.events,
    replies: data.replies,
    notes: data.notes,
    tasks: data.tasks,
    deal,
  });
  const env = getOutboundEnv();
  const proximoDiaUtil = nextBusinessDay(new Date(), env.utcOffset);
  const nome = [contact.nome, contact.sobrenome].filter(Boolean).join(" ") || "(sem nome)";

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="contatos"
      data={data}
      title={nome}
      subtitle={[contact.cargo, contact.empresa, contact.industria].filter(Boolean).join(" · ") || "Conta do contato"}
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          {deal ? (
            <Link href={consoleHref("/interno/outbound/pipeline", isDemo)} title="Ver no pipeline">
              <Chip tone={DEAL_STAGE_TONES[deal.stage]}>negócio: {DEAL_STAGE_LABELS[deal.stage]}</Chip>
            </Link>
          ) : null}
          {contact.status !== "suppressed" ? (
            <form action={suppressContactAction}>
              <input type="hidden" name="contactId" value={contact.id} />
              {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
              <button
                type="submit"
                title="Suprimir: sai de todas as campanhas e nunca mais recebe e-mail (permanente)"
                className="rounded-full border border-error/40 px-2.5 py-1 text-xs font-semibold text-error transition-colors duration-(--duration-fast) hover:bg-error-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Suprimir
              </button>
            </form>
          ) : (
            <Chip tone="error">suprimido</Chip>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="font-display text-h4 font-bold">
            Linha do tempo
          </h2>
          {/* PII: o e-mail do contato fica só neste tooltip. */}
          <p className="mt-1 text-xs text-foreground-subtle" title={contact.email}>
            Tudo que aconteceu com esta conta: envios, entregas, respostas, notas, tarefas e o negócio.
          </p>
          {enrollments.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {enrollments.map((e) => (
                <Chip key={e.id} tone={e.status === "active" ? "success" : "neutral"}>
                  {e.campaignSlug} · {e.status === "active" ? `passo ${e.nextStep + 1}` : e.status}
                </Chip>
              ))}
            </p>
          ) : null}
          {timeline.length === 0 ? (
            <div className="mt-4">
              <EmptyState>Nada registrado ainda para esta conta.</EmptyState>
            </div>
          ) : (
            <ol className="mt-4 flex flex-col gap-0 rounded-lg border border-border bg-surface">
              {timeline.map((item, i) => (
                <li
                  key={`${item.at}-${item.kind}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 transition-colors duration-(--duration-fast) first:border-t-0 hover:bg-surface-hover"
                >
                  <span className="w-32 shrink-0 text-xs whitespace-nowrap text-foreground-subtle tabular-nums">
                    {fmtDateTime(item.at)}
                  </span>
                  <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground-muted">
                    <span aria-hidden className={`size-1.5 rounded-full ${TIMELINE_STYLE[item.kind].dot}`} />
                    {TIMELINE_STYLE[item.kind].label}
                  </span>
                  <span className="min-w-0 text-small text-foreground">{item.label}</span>
                  {item.detail ? <span className="min-w-0 text-xs text-foreground-subtle">{item.detail}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <Card as="section" padding="sm" aria-labelledby="nota-title">
            <h2 id="nota-title" className="font-display text-h4 font-bold">
              Nova nota
            </h2>
            <form action={addNoteAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="contactId" value={contact.id} />
              {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
              <label htmlFor="nota-body" className="sr-only">
                Texto da nota
              </label>
              <textarea
                id="nota-body"
                name="body"
                rows={3}
                required
                className={`${CONTROL} resize-y`}
                placeholder="ex.: dono quer ver casos de incorporadoras antes da call"
              />
              <div>
                <Button type="submit" size="sm">
                  Salvar nota
                </Button>
              </div>
              <p className="text-xs text-foreground-subtle">Notas são permanentes: sem editar nem excluir.</p>
            </form>
          </Card>

          <Card as="section" padding="sm" aria-labelledby="tarefa-title">
            <h2 id="tarefa-title" className="font-display text-h4 font-bold">
              Nova tarefa
            </h2>
            {openTasks.length > 0 ? (
              <p className="mt-1 text-xs text-foreground-subtle">
                {openTasks.length} tarefa(s) aberta(s) desta conta na aba{" "}
                <Link href={consoleHref("/interno/outbound/hoje", isDemo)} className="underline underline-offset-2">
                  Hoje
                </Link>
                .
              </p>
            ) : null}
            <form action={createTaskAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="contactId" value={contact.id} />
              {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
              <div className="flex flex-col gap-1">
                <label htmlFor="tarefa-titulo" className={LABEL}>
                  O que fazer
                </label>
                <input
                  id="tarefa-titulo"
                  name="titulo"
                  required
                  className={CONTROL}
                  placeholder="ex.: enviar proposta comentada"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="tarefa-due" className={LABEL}>
                  Para quando
                </label>
                <input
                  id="tarefa-due"
                  type="date"
                  name="dueDate"
                  required
                  defaultValue={proximoDiaUtil}
                  className={CONTROL}
                />
              </div>
              <div>
                <Button type="submit" size="sm" variant="secondary">
                  Criar tarefa
                </Button>
              </div>
            </form>
          </Card>

          <Card as="section" padding="sm" aria-labelledby="conta-resposta-title">
            <h2 id="conta-resposta-title" className="font-display text-h4 font-bold">
              Registrar resposta
            </h2>
            <form action={registerReplyAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="contactId" value={contact.id} />
              {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
              <div className="flex flex-col gap-1">
                <label htmlFor="conta-classe" className={LABEL}>
                  Classe
                </label>
                <select id="conta-classe" name="classification" required defaultValue="" className={CONTROL}>
                  <option value="" disabled>
                    selecione a classe…
                  </option>
                  {REPLY_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {REPLY_CLASS_LABELS[cls]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="conta-notas" className={LABEL}>
                  Notas <span className="font-normal text-foreground-subtle">(opcional)</span>
                </label>
                <textarea id="conta-notas" name="notes" rows={2} className={`${CONTROL} resize-y`} />
              </div>
              <Checkbox id="conta-suppress" name="suppress" value="1" label="pediu para não receber (opt-out)" />
              <div>
                <Button type="submit" size="sm">
                  Registrar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </ConsoleShell>
  );
}
