import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { requireSession } from "@/lib/outbound/auth";
import { DEAL_STAGES } from "@/lib/outbound/crm-core";
import type { Contact, Deal, DealStage } from "@/lib/outbound/types";
import { moveDealStageAction, reconcileDealsAction } from "../crm-actions";
import { demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConsoleShell } from "../shell";
import { Chip, DEAL_STAGE_LABELS, DEAL_STAGE_TONES, EmptyState, fmtBRL, fmtInt } from "../ui";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline · outbound · interno",
  robots: { index: false, follow: false },
};

const CONTROL_CLASS =
  "h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground " +
  "placeholder:text-foreground-subtle/80 hover:border-border-strong " +
  "focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";

function daysInStage(deal: Deal, now: Date): number {
  const ms = now.getTime() - Date.parse(deal.stageChangedAt);
  return ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

function DealCard({ deal, contact, isDemo, now }: { deal: Deal; contact?: Contact; isDemo: boolean; now: Date }) {
  const nome = contact ? [contact.nome, contact.sobrenome].filter(Boolean).join(" ") : "(contato removido)";
  const empresa = deal.empresa ?? contact?.empresa ?? nome;
  const dias = daysInStage(deal, now);
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      {/* PII: e-mail só em tooltip, nunca como texto visível. */}
      <div className="min-w-0" title={contact?.email}>
        <p className="truncate text-small font-semibold text-foreground">{empresa}</p>
        <p className="truncate text-xs text-foreground-muted">
          {nome}
          {contact?.cargo ? <span className="text-foreground-subtle"> · {contact.cargo}</span> : null}
        </p>
      </div>
      <p className="text-xs text-foreground-subtle tabular-nums">
        {deal.campaignSlug ?? "manual"} · {fmtInt(dias)}d no estágio
        {deal.valorEstimado ? ` · ${fmtBRL(deal.valorEstimado)}` : ""}
      </p>
      {deal.stage === "reuniao_marcada" && deal.reuniaoEm ? (
        <p className="text-xs font-semibold text-success tabular-nums">
          reunião {new Date(deal.reuniaoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
      ) : null}
      {deal.stage === "perdido" && deal.lostReason ? (
        <p className="text-xs text-foreground-subtle">motivo: {deal.lostReason}</p>
      ) : null}
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-brand-strong">Mover</summary>
        <form action={moveDealStageAction} className="mt-2 flex flex-col gap-1.5">
          <input type="hidden" name="dealId" value={deal.id} />
          {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <label className="flex flex-col gap-0.5">
            <span className="text-foreground-subtle">novo estágio</span>
            <select name="stage" defaultValue={deal.stage} className={CONTROL_CLASS}>
              {DEAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {DEAL_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-foreground-subtle">reunião (se marcar)</span>
            <input type="datetime-local" name="reuniaoEm" className={CONTROL_CLASS} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-foreground-subtle">motivo (se perdido)</span>
            <input type="text" name="motivo" className={CONTROL_CLASS} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-foreground-subtle">valor estimado (R$)</span>
            <input
              type="text"
              name="valor"
              inputMode="numeric"
              defaultValue={deal.valorEstimado ?? ""}
              className={CONTROL_CLASS}
            />
          </label>
          <button
            type="submit"
            className="mt-0.5 rounded-md border border-border bg-background-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:border-border-strong"
          >
            Mover
          </button>
        </form>
      </details>
    </article>
  );
}

/** Pipeline de negócios: 8 estágios; novo/contatado/respondeu vêm do outbound. */
export default async function OutboundPipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const now = new Date();

  const contactById = new Map(data.contacts.map((c) => [c.id, c]));
  const byStage = new Map<DealStage, Deal[]>(DEAL_STAGES.map((s) => [s, []]));
  for (const deal of data.deals) byStage.get(deal.stage)?.push(deal);
  for (const list of byStage.values()) {
    list.sort((a, b) => b.stageChangedAt.localeCompare(a.stageChangedAt));
  }

  const sync = (
    <form action={reconcileDealsAction}>
      {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
      <Button type="submit" variant="secondary" size="sm" className="min-h-8 px-3.5 py-1 text-xs">
        Sincronizar pipeline
      </Button>
    </form>
  );

  return (
    <ConsoleShell
      active="pipeline"
      data={data}
      title="Pipeline"
      subtitle="Negócios por estágio. Novo, contatado e respondeu andam sozinhos com o outbound; do meio em diante a decisão é sua."
      headerExtra={sync}
      sessionEmail={session.email}
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-foreground-subtle">
          Mover um cartão NÃO pausa nem cancela e-mails. Para parar envios de um contato, use Suprimir na aba Contatos
          ou registre a resposta dele.
        </p>
        {data.deals.length === 0 ? (
          <EmptyState>
            Nenhum negócio ainda. Clique em <span className="font-semibold">Sincronizar pipeline</span> para criar os
            negócios a partir das sequências do outbound.
          </EmptyState>
        ) : (
          <div tabIndex={0} role="region" aria-label="Pipeline de negócios" className="overflow-x-auto pb-2">
            <div className="grid min-w-[96rem] grid-cols-8 gap-3">
              {DEAL_STAGES.map((stage) => {
                const list = byStage.get(stage) ?? [];
                const total = list.reduce((sum, d) => sum + (d.valorEstimado ?? 0), 0);
                return (
                  <section key={stage} aria-label={DEAL_STAGE_LABELS[stage]} className="flex min-w-0 flex-col gap-2">
                    <header className="flex items-center justify-between gap-2 border-b border-border pb-2">
                      <Chip tone={DEAL_STAGE_TONES[stage]}>{DEAL_STAGE_LABELS[stage]}</Chip>
                      <span className="text-xs text-foreground-subtle tabular-nums">
                        {fmtInt(list.length)}
                        {total > 0 ? ` · ${fmtBRL(total)}` : ""}
                      </span>
                    </header>
                    <div className="flex flex-col gap-2">
                      {list.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          contact={contactById.get(deal.contactId)}
                          isDemo={isDemo}
                          now={now}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}
