import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/outbound/auth";
import type { OutboundEvent, OutboundEventType } from "@/lib/outbound/types";
import { FiltroSelect } from "../contatos/filtros";
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
  fmtInt,
  OpenRateNote,
  plural,
  Quando,
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

/** A página cresce de 200 em 200 pelo "Mostrar mais" (?limite=), com teto de sanidade. */
const LIMITE_PASSO = 200;
const LIMITE_TETO = 2000;

/** Filtro de período sobre occurredAt (?periodo=7|30; vazio = tudo). */
const PERIODOS = [
  { value: "", label: "todo o histórico" },
  { value: "7", label: "últimos 7 dias" },
  { value: "30", label: "últimos 30 dias" },
] as const;

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

/** Comparação case/acento-insensitive (pt-BR): "São" casa com "sao". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Atividade — linha do tempo dos eventos do Resend (sync por polling, PRD §14).
 * Agrupada por dia, filtrável por tipo e campanha via GET (preservando o modo demo).
 */
export default async function OutboundActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

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

  const q = firstString(sp.q)?.trim() ?? "";
  const qFold = fold(q);
  const periodoRaw = firstString(sp.periodo);
  const periodo = periodoRaw === "7" || periodoRaw === "30" ? periodoRaw : "";
  const cutoff = periodo ? new Date().getTime() - Number(periodo) * 86_400_000 : 0;
  const limiteRaw = Number.parseInt(firstString(sp.limite) ?? "", 10);
  const limite = Number.isFinite(limiteRaw) ? Math.min(Math.max(limiteRaw, LIMITE_PASSO), LIMITE_TETO) : LIMITE_PASSO;

  const filtered = events
    .filter((e) => {
      if (tipo && e.type !== tipo) return false;
      if (campanha && e.campaignSlug !== campanha) return false;
      if (cutoff && Date.parse(e.occurredAt) < cutoff) return false;
      if (qFold) {
        // Busca pelo contato do evento (nome/empresa; e-mail casa no filtro mas nunca vira texto).
        const send = sendsById.get(e.sendId);
        const contact = send ? contactsById.get(send.contactId) : undefined;
        if (!contact) return false;
        const hay = fold([contact.nome, contact.sobrenome ?? "", contact.empresa ?? "", contact.email].join(" "));
        if (!hay.includes(qFold)) return false;
      }
      return true;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.recordedAt.localeCompare(a.recordedAt));
  const shown = filtered.slice(0, limite);

  /** Href do "Mostrar mais": preserva filtros e demo. */
  const maisHref = (() => {
    const params = new URLSearchParams();
    if (isDemo) params.set("demo", "1");
    if (tipo) params.set("tipo", tipo);
    if (campanha) params.set("campanha", campanha);
    if (q) params.set("q", q);
    if (periodo) params.set("periodo", periodo);
    params.set("limite", String(Math.min(limite + LIMITE_PASSO, LIMITE_TETO)));
    return `/interno/outbound/atividade?${params.toString()}`;
  })();

  // Agrupamento por dia (fuso de São Paulo) — a ordenação garante grupos contíguos.
  const groups: Array<{ date: string; rows: OutboundEvent[] }> = [];
  for (const event of shown) {
    const date = fmtDate(event.occurredAt);
    const last = groups.at(-1);
    if (last && last.date === date) last.rows.push(event);
    else groups.push({ date, rows: [event] });
  }

  const hasFilter = Boolean(tipo || campanha || q || periodo);
  const hasOpened = shown.some((e) => e.type === "opened");

  return (
    <ConsoleShell
      sessionEmail={session.email}
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
              <label htmlFor="filtro-contato" className={LABEL}>
                Contato
              </label>
              <input
                id="filtro-contato"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="nome ou empresa"
                className={`${CONTROL} w-52`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-tipo" className={LABEL}>
                Tipo de evento
              </label>
              <FiltroSelect id="filtro-tipo" name="tipo" defaultValue={tipo ?? ""} className={CONTROL}>
                <option value="">todos</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </FiltroSelect>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-campanha" className={LABEL}>
                Campanha
              </label>
              <FiltroSelect id="filtro-campanha" name="campanha" defaultValue={campanha ?? ""} className={CONTROL}>
                <option value="">todas</option>
                {defs.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.industria} ({d.slug})
                  </option>
                ))}
              </FiltroSelect>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-periodo" className={LABEL}>
                Período
              </label>
              <FiltroSelect id="filtro-periodo" name="periodo" defaultValue={periodo} className={CONTROL}>
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </FiltroSelect>
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
              <div
                tabIndex={0}
                role="region"
                aria-label="Linha do tempo de eventos"
                className="overflow-x-auto rounded-lg border border-border bg-surface"
              >
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
                          {group.date} · {plural(group.rows.length, "evento")}
                        </th>
                      </tr>
                      {group.rows.map((event) => {
                        const send = sendsById.get(event.sendId);
                        const contact = send ? contactsById.get(send.contactId) : undefined;
                        const def = defsBySlug.get(event.campaignSlug);
                        return (
                          <tr
                            key={event.id}
                            className="border-t border-border align-top transition-colors duration-(--duration-fast) hover:bg-surface-hover"
                          >
                            <td className="px-3 py-2">
                              <Chip tone={EVENT_TYPE_TONES[event.type]}>{EVENT_TYPE_LABELS[event.type]}</Chip>
                            </td>
                            <td className="px-3 py-2">
                              {/* Chip-link da casa (mesma âncora de Contatos/Respostas). */}
                              <Link
                                href={consoleHref(`/interno/outbound/${event.campaignSlug}`, isDemo)}
                                title={event.campaignSlug}
                                className="inline-block max-w-[11rem] truncate rounded-full bg-background-secondary px-2 py-0.5 text-xs whitespace-nowrap text-foreground-muted transition-colors duration-(--duration-fast) hover:bg-brand-soft hover:text-brand-strong"
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
                              <Quando iso={event.occurredAt} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
                {/* A timeline cresce aqui mesmo, preservando os filtros (P1 #3 do plano). */}
                {filtered.length > shown.length ? (
                  <div className="border-t border-border bg-background-secondary/30 px-3 py-2.5 text-center text-small">
                    <Link
                      href={maisHref}
                      className="font-semibold text-brand-strong underline-offset-2 hover:underline"
                    >
                      Mostrar mais {fmtInt(Math.min(LIMITE_PASSO, filtered.length - shown.length))}
                    </Link>{" "}
                    <span className="text-foreground-subtle tabular-nums">
                      · exibindo {fmtInt(shown.length)} de {fmtInt(filtered.length)}
                    </span>
                  </div>
                ) : null}
              </div>
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
