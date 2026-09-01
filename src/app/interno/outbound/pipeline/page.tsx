import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/outbound/auth";
import type { Deal } from "@/lib/outbound/types";
import { reconcileDealsAction } from "../crm-actions";
import { demoRequested, loadDashboardData, type SearchParams } from "../data";
import { SubmitButton } from "../pending";
import { ConsoleShell } from "../shell";
import { EmptyState, plural } from "../ui";
import { PipelineBoard, type BoardDeal } from "./board";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline · outbound · interno",
  robots: { index: false, follow: false },
};

function daysInStage(deal: Deal, now: Date): number {
  const ms = now.getTime() - Date.parse(deal.stageChangedAt);
  return ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

/**
 * Pipeline de negócios: kanban com drag and drop (board.tsx) sobre 8 estágios;
 * novo/contatado/respondeu vêm do outbound (piso automático do reconcile).
 * O servidor só monta os dados (dias no estágio calculados aqui para não
 * divergir na hidratação); toda a interação vive no client.
 */
export default async function OutboundPipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const now = new Date();

  // Resultado do "Sincronizar pipeline" (?sync=criados:avancados), dispensável com um clique.
  const syncRaw = typeof sp.sync === "string" ? sp.sync : Array.isArray(sp.sync) ? (sp.sync[0] ?? "") : "";
  const syncMatch = /^(\d+):(\d+)$/.exec(syncRaw);
  const syncInfo = syncMatch ? { criados: Number(syncMatch[1]), avancados: Number(syncMatch[2]) } : null;

  const contactById = new Map(data.contacts.map((c) => [c.id, c]));
  const boardDeals: BoardDeal[] = [...data.deals]
    .sort((a, b) => b.stageChangedAt.localeCompare(a.stageChangedAt))
    .map((deal) => {
      const contact = contactById.get(deal.contactId);
      const nome = contact
        ? [contact.nome, contact.sobrenome].filter(Boolean).join(" ") || "(sem nome)"
        : "(contato removido)";
      return {
        id: deal.id,
        stage: deal.stage,
        floor: deal.autoStage ?? "novo",
        empresa: deal.empresa ?? contact?.empresa ?? nome,
        nome,
        cargo: contact?.cargo,
        // PII: segue só para tooltip no card, nunca texto visível.
        email: contact?.email,
        campaignSlug: deal.campaignSlug,
        valorEstimado: deal.valorEstimado,
        reuniaoEm: deal.reuniaoEm,
        lostReason: deal.lostReason,
        diasNoEstagio: daysInStage(deal, now),
      };
    });

  const sync = (
    <form action={reconcileDealsAction}>
      {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
      <SubmitButton variant="secondary" size="sm" className="min-h-8 px-3.5 py-1 text-xs" loadingLabel="Sincronizando">
        Sincronizar pipeline
      </SubmitButton>
    </form>
  );

  return (
    <ConsoleShell
      active="pipeline"
      data={data}
      title="Pipeline"
      subtitle="Arraste o cartão entre estágios. Novo, contatado e respondeu andam sozinhos com o outbound; do meio em diante a decisão é sua."
      headerExtra={sync}
      sessionEmail={session.email}
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-foreground-subtle">
          Mover um cartão NÃO pausa nem cancela e-mails. Para parar envios de um contato, use Suprimir na aba Contatos
          ou registre a resposta dele.
        </p>
        {syncInfo ? (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-brand-strong/30 bg-brand-soft px-4 py-2.5 text-small text-foreground"
          >
            <span className="font-semibold">Pipeline sincronizado:</span>
            <span>
              {syncInfo.criados + syncInfo.avancados > 0
                ? `${plural(syncInfo.criados, "negócio criado", "negócios criados")} · ${plural(syncInfo.avancados, "avançado")}.`
                : "nada novo no outbound desde a última sincronização."}
            </span>
            <Link
              href={isDemo ? "/interno/outbound/pipeline?demo=1" : "/interno/outbound/pipeline"}
              className="ml-auto text-xs font-semibold text-brand-strong underline-offset-2 hover:underline"
            >
              ok
            </Link>
          </div>
        ) : null}
        {boardDeals.length === 0 ? (
          <EmptyState>
            Nenhum negócio ainda. Clique em <span className="font-semibold">Sincronizar pipeline</span> para criar os
            negócios a partir das sequências do outbound.
          </EmptyState>
        ) : (
          <PipelineBoard deals={boardDeals} isDemo={isDemo} />
        )}
      </div>
    </ConsoleShell>
  );
}
