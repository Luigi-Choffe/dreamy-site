import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IS_PRODUCTION_SITE } from "@/config/env";
import type { OutboundEvent, OutboundEventType } from "@/lib/outbound/types";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConsoleShell } from "../shell";
import {
  Chip,
  Code,
  ContactCell,
  EmptyState,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_TONES,
  fmtDate,
  fmtDateTime,
  fmtInt,
  OpenRateNote,
} from "../ui";

/** Sempre dinâmico: lê o store local (`.outbound/` ou `.outbound-demo/`) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outbound · atividade · interno",
  robots: { index: false, follow: false },
};

/** Ordem de exibição dos tipos no filtro (ciclo de vida do envio). */
const EVENT_TYPES: OutboundEventType[] = [
  "sent",
  "delivered",
  "delivery_delayed",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "failed",
  "canceled",
  "suppressed",
];

/** Teto da timeline — o resto fica no store (relatórios via CLI). */
const TIMELINE_LIMIT = 200;

// Densidade de console: controles e células compactos, coerentes com o design system.
const TH = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-foreground-subtle uppercase";
const CONTROL =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-small text-foreground " +
  "hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";
const BTN_SM =
  "rounded-full border border-border-strong bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground " +
  "hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const LABEL = "text-xs font-semibold text-foreground";

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/**
 * Atividade — linha do tempo dos eventos do Resend (sync por polling, PRD §14).
 * Agrupada por dia, filtrável por tipo e campanha via GET (preservando o modo demo).
 */
export default async function OutboundActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // V1 é 100% local (sem deploy) — em produção o console nem renderiza (PRD §16).
  if (IS_PRODUCTION_SITE) notFound();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const { defs, contacts, sends, events } = data;

  // Filtros GET — valores desconhecidos caem para "todos" (nunca quebram a página).
  const tipoRaw = firstString(sp.tipo);
  const tipo = EVENT_TYPES.find((t) => t === tipoRaw);
  const campanhaRaw = firstString(sp.campanha);
  const campanha = defs.find((d) => d.slug === campanhaRaw)?.slug;

  const defsBySlug = new Map(defs.map((d) => [d.slug, d]));
  const sendsById = new Map(sends.map((s) => [s.id, s]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  const filtered = events
    .filter((e) => (!tipo || e.type === tipo) && (!campanha || e.campaignSlug === campanha))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.recordedAt.localeCompare(a.recordedAt));
  const shown = filtered.slice(0, TIMELINE_LIMIT);

  // Agrupamento por dia (fuso de São Paulo) — a ordenação garante grupos contíguos.
  const groups: Array<{ date: string; rows: OutboundEvent[] }> = [];
  for (const event of shown) {
    const date = fmtDate(event.occurredAt);
    const last = groups.at(-1);
    if (last && last.date === date) last.rows.push(event);
    else groups.push({ date, rows: [event] });
  }

  const hasFilter = Boolean(tipo || campanha);
  const hasOpened = shown.some((e) => e.type === "opened");

  return (
    <ConsoleShell
      active="atividade"
      data={data}
      title="Atividade"
      subtitle="Linha do tempo dos eventos de entrega — atualizada a cada pnpm outbound:sync."
    >
      <div className="flex flex-col gap-5">
        <section aria-label="Filtros da linha do tempo">
          <form method="get" action="/interno/outbound/atividade" className="flex flex-wrap items-end gap-3">
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-tipo" className={LABEL}>
                Tipo de evento
              </label>
              <select id="filtro-tipo" name="tipo" defaultValue={tipo ?? ""} className={CONTROL}>
                <option value="">todos</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-campanha" className={LABEL}>
                Campanha
              </label>
              <select id="filtro-campanha" name="campanha" defaultValue={campanha ?? ""} className={CONTROL}>
                <option value="">todas</option>
                {defs.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.industria} ({d.slug})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={BTN_SM}>
              Filtrar
            </button>
            {hasFilter ? (
              <Link
                href={consoleHref("/interno/outbound/atividade", isDemo)}
                className="py-1.5 text-xs text-foreground-muted underline underline-offset-2 hover:text-brand-strong"
              >
                Limpar filtros
              </Link>
            ) : null}
          </form>
        </section>

        <section aria-labelledby="atividade-timeline-title">
          <h2 id="atividade-timeline-title" className="sr-only">
            Linha do tempo
          </h2>
          {events.length === 0 ? (
            <EmptyState>
              Eventos aparecem aqui após o primeiro <Code>pnpm outbound:sync</Code>.
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState>Nenhum evento com esses filtros.</EmptyState>
          ) : (
            <>
              <div tabIndex={0} role="region" aria-label="Linha do tempo de eventos" className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[44rem] text-small">
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>
                        Evento
                      </th>
                      <th scope="col" className={TH}>
                        Campanha
                      </th>
                      <th scope="col" className={TH}>
                        Passo
                      </th>
                      <th scope="col" className={TH}>
                        Contato
                      </th>
                      <th scope="col" className={TH}>
                        Quando
                      </th>
                    </tr>
                  </thead>
                  {groups.map((group) => (
                    <tbody key={group.date}>
                      <tr className="border-t border-border-strong bg-background-secondary/40">
                        <th
                          scope="rowgroup"
                          colSpan={5}
                          className="px-3 py-1.5 text-left text-xs font-semibold text-foreground-muted tabular-nums"
                        >
                          {group.date}
                        </th>
                      </tr>
                      {group.rows.map((event) => {
                        const send = sendsById.get(event.sendId);
                        const contact = send ? contactsById.get(send.contactId) : undefined;
                        const def = defsBySlug.get(event.campaignSlug);
                        return (
                          <tr key={event.id} className="border-t border-border align-top">
                            <td className="px-3 py-2">
                              <Chip tone={EVENT_TYPE_TONES[event.type]}>{EVENT_TYPE_LABELS[event.type]}</Chip>
                            </td>
                            <td className="px-3 py-2">
                              <Link
                                href={consoleHref(`/interno/outbound/${event.campaignSlug}`, isDemo)}
                                className="text-brand-strong hover:underline"
                                title={event.campaignSlug}
                              >
                                {def?.industria ?? event.campaignSlug}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-foreground-muted uppercase tabular-nums">
                              {send?.stepId ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {contact ? (
                                <ContactCell contact={contact} />
                              ) : (
                                <span className="text-foreground-subtle">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-foreground-muted tabular-nums">
                              {fmtDateTime(event.occurredAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
              {filtered.length > shown.length ? (
                <p className="mt-2 text-xs text-foreground-subtle">
                  Mostrando os {fmtInt(shown.length)} eventos mais recentes de {fmtInt(filtered.length)} — o histórico
                  completo fica no store.
                </p>
              ) : null}
              {hasOpened ? (
                <div className="mt-2">
                  <OpenRateNote />
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
