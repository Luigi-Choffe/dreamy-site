import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/outbound/auth";
import type { AgentActivity } from "@/lib/outbound/types";
import { Aquario } from "../aquario";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { FluxoDoAgente } from "./fluxo";
import { BiDaOperacao, GestaoDoTime } from "./gestao";
import { ConsoleShell } from "../shell";
import { AGENT_ACTIVITY_LABELS, Code, EmptyState, fmtDate, fmtDateTime, fmtInt, Stat } from "../ui";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MORK · outbound · interno",
  robots: { index: false, follow: false },
};

const TIMELINE_LIMIT = 150;
const WEEK_MS = 7 * 86_400_000;

function refLinks(activity: AgentActivity, isDemo: boolean): Array<{ href: string; label: string }> {
  const refs = activity.refs;
  if (!refs) return [];
  const links: Array<{ href: string; label: string }> = [];
  if (refs.demandId) links.push({ href: consoleHref("/interno/outbound/demandas", isDemo), label: "demanda" });
  if (refs.campaignSlug)
    links.push({ href: consoleHref(`/interno/outbound/${refs.campaignSlug}`, isDemo), label: refs.campaignSlug });
  if (refs.contactId)
    links.push({ href: consoleHref(`/interno/outbound/contatos/${refs.contactId}`, isDemo), label: "conta" });
  return links;
}

/** Prestação de contas do MORK: o que o agente e o time fizeram, dia a dia. */
export default async function MorkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const now = new Date().getTime();

  const enviados = data.sends.filter((s) => s.status === "sent" || s.status === "delivered").length;
  const reunioes = data.deals.filter((d) => d.stage === "reuniao_marcada").length;
  const tarefasConcluidas = data.tasks.filter((t) => t.status === "concluida").length;

  const pendentes = data.demands.filter((d) => d.status === "pendente").length;
  const emAndamento = data.demands.filter((d) => d.status === "em_andamento").length;
  const concluidasSemana = data.demands.filter(
    (d) => d.status === "concluida" && d.doneAt && now - Date.parse(d.doneAt) <= WEEK_MS,
  ).length;
  const atividadesSemana = data.agentActivities.filter((a) => now - Date.parse(a.at) <= WEEK_MS).length;

  const ordered = [...data.agentActivities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, TIMELINE_LIMIT);
  const groups: Array<{ date: string; rows: AgentActivity[] }> = [];
  for (const activity of ordered) {
    const date = fmtDate(activity.at);
    const last = groups.at(-1);
    if (last && last.date === date) last.rows.push(activity);
    else groups.push({ date, rows: [activity] });
  }

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="mork"
      data={data}
      title="MORK"
      subtitle="O agente de vendas da Dreamy presta contas aqui: demandas, pipeline, briefings e sugestões."
    >
      <div className="flex flex-col gap-8">
        <section aria-label="Resumo do MORK">
          <Card padding="sm">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <Stat label="Pendentes" value={fmtInt(pendentes)} hint="demandas aguardando o MORK" />
              <Stat label="Em andamento" value={fmtInt(emAndamento)} />
              <Stat
                label="Concluídas (7d)"
                value={fmtInt(concluidasSemana)}
                tone={concluidasSemana > 0 ? "success" : "default"}
              />
              <Stat label="Ações (7d)" value={fmtInt(atividadesSemana)} hint="tudo que ficou registrado" />
            </dl>
          </Card>
        </section>

        {/* O palco (docs/AQUARIO-VIVO.md): Entrada de dados → Raciocínio → Ações,
            com a lente completa do Aquário no centro e números reais nas pontas. */}
        <section aria-labelledby="mork-fluxo-title">
          <h2 id="mork-fluxo-title" className="font-display text-h4 font-bold">
            Como o time trabalha
          </h2>
          <p className="mt-1 max-w-2xl text-small text-foreground-muted">
            Dados entram, a rede decide, ações saem. Passe o mouse num agente para a ficha; os balões de conversa citam
            o que ficou registrado no diário.
          </p>
          <div className="mt-5">
            <FluxoDoAgente
              entrada={{ contatos: data.contacts.length, respostas: data.replies.length }}
              acoes={{ enviados, reunioes, tarefas: tarefasConcluidas }}
            >
              <Aquario data={data} />
            </FluxoDoAgente>
          </div>
        </section>

        {/* Central de gerenciamento do time (pedido do Luigi, 2026-09-02): quem
            está com o quê, entregas por cadeira e o BI da operação — tudo
            derivado dos registros reais (team-bi.ts, puro e testado). */}
        <section aria-labelledby="mork-gestao-title">
          <h2 id="mork-gestao-title" className="font-display text-h4 font-bold">
            Gestão do time
          </h2>
          <p className="mt-1 max-w-2xl text-small text-foreground-muted">
            A carga, as entregas e a estratégia de cada cadeira, direto da fila de demandas e do diário. É assim que uma
            equipe de agentes se gerencia.
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <GestaoDoTime demands={data.demands} activities={data.agentActivities} now={new Date(now)} />
            <BiDaOperacao demands={data.demands} activities={data.agentActivities} now={new Date(now)} />
          </div>
        </section>

        <section aria-labelledby="mork-timeline-title">
          <h2 id="mork-timeline-title" className="font-display text-h4 font-bold">
            Diário de bordo
          </h2>
          {ordered.length === 0 ? (
            <div className="mt-3">
              <EmptyState>
                Nada registrado ainda. As ações do MORK (CLI <Code>pnpm outbound:demandas</Code>,{" "}
                <Code>pnpm outbound:crm</Code>) e do console aparecem aqui.
              </EmptyState>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-border bg-surface">
              {groups.map((group) => (
                <div key={group.date}>
                  <p className="border-t border-border-strong bg-background-secondary/40 px-4 py-1.5 text-xs font-semibold text-foreground-muted tabular-nums first:border-t-0">
                    {group.date}
                  </p>
                  <ol>
                    {group.rows.map((activity) => (
                      <li
                        key={activity.id}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface-hover"
                      >
                        <span className="w-14 shrink-0 text-xs whitespace-nowrap text-foreground-subtle tabular-nums">
                          {fmtDateTime(activity.at).slice(-5)}
                        </span>
                        {/* Ator vira ponto + texto (verde só para o MORK); tipo vira rótulo mudo. */}
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground-muted">
                          <span
                            aria-hidden
                            className={`size-1.5 rounded-full ${activity.actor === "mork" ? "bg-brand" : "bg-border-strong"}`}
                          />
                          {activity.actor}
                        </span>
                        <span className="shrink-0 text-xs text-foreground-subtle">
                          {AGENT_ACTIVITY_LABELS[activity.kind]}
                        </span>
                        <span className="min-w-0 flex-1 text-small text-foreground">{activity.summary}</span>
                        {refLinks(activity, isDemo).map((link) => (
                          <Link
                            key={link.href + link.label}
                            href={link.href}
                            className="text-xs text-brand-strong underline-offset-2 hover:underline"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
          {data.agentActivities.length > ordered.length ? (
            <p className="mt-2 text-xs text-foreground-subtle">
              Mostrando as {fmtInt(ordered.length)} ações mais recentes de {fmtInt(data.agentActivities.length)}.
            </p>
          ) : null}
        </section>
      </div>
    </ConsoleShell>
  );
}
