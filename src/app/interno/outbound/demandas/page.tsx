import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/outbound/auth";
import { DEMAND_KINDS } from "@/lib/outbound/demands-core";
import type { Demand, DemandStatus } from "@/lib/outbound/types";
import { demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConsoleShell } from "../shell";
import {
  Chip,
  Code,
  DEMAND_KIND_LABELS,
  DEMAND_STATUS_LABELS,
  DEMAND_STATUS_TONES,
  EmptyState,
  fmtDateTime,
  fmtInt,
} from "../ui";
import { cancelDemandAction, createDemandAction, updateDemandStatusAction } from "./actions";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demandas · outbound · interno",
  robots: { index: false, follow: false },
};

const STATUS_ORDER: DemandStatus[] = ["pendente", "em_andamento", "concluida", "recusada", "cancelada"];

const CONTROL =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-small text-foreground " +
  "hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";
const LABEL = "text-xs font-semibold text-foreground";
const BTN =
  "rounded-md border border-border bg-background-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:border-border-strong";

function DemandRow({ demand, isDemo }: { demand: Demand; isDemo: boolean }) {
  return (
    <li className="flex flex-col gap-2 border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={DEMAND_STATUS_TONES[demand.status]}>{DEMAND_STATUS_LABELS[demand.status]}</Chip>
        <Chip tone="outline">{DEMAND_KIND_LABELS[demand.kind]}</Chip>
        {demand.priority === "alta" ? <Chip tone="error">alta</Chip> : null}
        <span className="min-w-0 flex-1 text-small font-semibold text-foreground">{demand.title}</span>
      </div>
      {demand.details ? <p className="text-xs text-foreground-muted">{demand.details}</p> : null}
      <p className="text-xs text-foreground-subtle tabular-nums">
        pedida por {demand.createdBy} em {fmtDateTime(demand.createdAt)}
        {demand.claimedBy ? ` · assumida por ${demand.claimedBy}` : ""}
        {demand.campaignSlug ? ` · campanha ${demand.campaignSlug}` : ""}
      </p>
      {demand.resolution ? (
        <p className="text-xs text-foreground-muted">
          <span className="font-semibold">resolução:</span> {demand.resolution}
        </p>
      ) : null}
      {demand.status === "pendente" ? (
        <div className="flex flex-wrap gap-1.5">
          <form action={updateDemandStatusAction} className="inline">
            <input type="hidden" name="demandId" value={demand.id} />
            <input type="hidden" name="to" value="em_andamento" />
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <button type="submit" className={BTN}>
              Assumir
            </button>
          </form>
          <form action={cancelDemandAction} className="inline">
            <input type="hidden" name="demandId" value={demand.id} />
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <button type="submit" className={BTN} title="Cancelar (só antes de alguém assumir)">
              Cancelar
            </button>
          </form>
        </div>
      ) : null}
      {demand.status === "em_andamento" ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-brand-strong">Encerrar</summary>
          <form action={updateDemandStatusAction} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="demandId" value={demand.id} />
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <label className="flex flex-col gap-0.5">
              <span className="text-foreground-subtle">como terminou</span>
              <select name="to" defaultValue="concluida" className={CONTROL}>
                <option value="concluida">concluída</option>
                <option value="recusada">recusada</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-foreground-subtle">resolução (obrigatória)</span>
              <input name="resolution" required className={CONTROL} placeholder="o que foi feito, ou por que não" />
            </label>
            <div>
              <button type="submit" className={BTN}>
                Salvar
              </button>
            </div>
          </form>
        </details>
      ) : null}
    </li>
  );
}

/** Fila de demandas: o time pede aqui; o MORK assume, executa e presta contas. */
export default async function OutboundDemandsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);

  const byStatus = new Map<DemandStatus, Demand[]>(STATUS_ORDER.map((s) => [s, []]));
  for (const demand of data.demands) byStatus.get(demand.status)?.push(demand);
  for (const list of byStatus.values()) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="demandas"
      data={data}
      title="Demandas"
      subtitle="Peça aqui; o MORK assume pela CLI e devolve com resolução. Tudo fica registrado."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="demandas-fila-title" className="flex flex-col gap-6">
          <h2 id="demandas-fila-title" className="sr-only">
            Fila de demandas
          </h2>
          {data.demands.length === 0 ? (
            <EmptyState>
              Nenhuma demanda ainda. Crie a primeira ao lado; o MORK lê a fila com{" "}
              <Code>pnpm outbound:demandas list</Code>.
            </EmptyState>
          ) : (
            STATUS_ORDER.map((status) => {
              const list = byStatus.get(status) ?? [];
              if (list.length === 0) return null;
              return (
                <div key={status}>
                  <h3 className="font-display text-h4 font-bold">
                    {DEMAND_STATUS_LABELS[status]} ({fmtInt(list.length)})
                  </h3>
                  <ol className="mt-2 rounded-lg border border-border bg-surface">
                    {list.map((demand) => (
                      <DemandRow key={demand.id} demand={demand} isDemo={isDemo} />
                    ))}
                  </ol>
                </div>
              );
            })
          )}
        </section>

        <Card as="section" padding="sm" aria-labelledby="demanda-nova-title">
          <h2 id="demanda-nova-title" className="font-display text-h4 font-bold">
            Nova demanda
          </h2>
          <form action={createDemandAction} className="mt-3 flex flex-col gap-3">
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <div className="flex flex-col gap-1">
              <label htmlFor="demanda-title" className={LABEL}>
                O que você precisa
              </label>
              <input
                id="demanda-title"
                name="title"
                required
                className={CONTROL}
                placeholder="ex.: campanha para obras para terceiros"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="demanda-kind" className={LABEL}>
                Tipo
              </label>
              <select id="demanda-kind" name="kind" required defaultValue="" className={CONTROL}>
                <option value="" disabled>
                  selecione…
                </option>
                {DEMAND_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {DEMAND_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="demanda-details" className={LABEL}>
                Detalhes <span className="font-normal text-foreground-subtle">(opcional)</span>
              </label>
              <textarea id="demanda-details" name="details" rows={3} className={`${CONTROL} resize-y`} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="demanda-campanha" className={LABEL}>
                Campanha <span className="font-normal text-foreground-subtle">(opcional)</span>
              </label>
              <select id="demanda-campanha" name="campaignSlug" defaultValue="" className={CONTROL}>
                <option value="">nenhuma</option>
                {data.defs.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.industria} ({d.slug})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-small text-foreground">
              <input type="checkbox" name="priority" value="alta" className="size-4 accent-[var(--brand-strong)]" />
              prioridade alta
            </label>
            <div>
              <Button type="submit" size="sm">
                Criar demanda
              </Button>
            </div>
            <p className="text-xs text-foreground-subtle">
              O MORK vê a fila na hora (mesmo banco) e presta contas na aba MORK.
            </p>
          </form>
        </Card>
      </div>
    </ConsoleShell>
  );
}
