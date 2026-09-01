import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { forecastCadence } from "@/lib/outbound/agenda-core";
import { requireSession } from "@/lib/outbound/auth";
import { getOutboundEnv, rampCap, sendDateKey } from "@/lib/outbound/config";
import { dailyCap, usedTodayCount } from "@/lib/outbound/engine";
import { evaluateGuardRails } from "@/lib/outbound/guardrails";
import {
  campaignMetrics,
  contactStats,
  dailySendSeries,
  meetingStats,
  replyTimeStats,
  valueFunnel,
} from "@/lib/outbound/metrics";
import type { ContactStatus, SuppressionReason, VerificationStatus } from "@/lib/outbound/types";
import { disarmAction } from "./actions";
import { BriefingCard } from "./briefing-card";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "./data";
import { ConsoleShell } from "./shell";
import {
  ANCHOR_LABELS,
  CampaignStatusChip,
  Chip,
  Code,
  CONTACT_STATUS_LABELS,
  campaignDisplayStatus,
  countBy,
  DailySendSparkline,
  fmtDate,
  fmtDateTime,
  fmtInt,
  fmtPct,
  Metric,
  OpenRateNote,
  plural,
  REPLY_CLASS_LABELS,
  Stat,
  SUPPRESSION_REASON_LABELS,
  ValueFunnel,
  VERIFICATION_LABELS,
} from "./ui";

/** Sempre dinâmico: lê o store local (`.outbound/` ou `.outbound-demo/`) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outbound · interno",
  robots: { index: false, follow: false },
};

const CONTACT_STATUSES: ContactStatus[] = ["active", "excluded", "suppressed"];
const VERIFICATION_STATUSES: VerificationStatus[] = ["ok", "risky", "invalid", "unverified"];
const SPARK_DAYS = 21;
const TOP_INDUSTRIES = 5;

const SECTION_TITLE = "font-display text-h4 font-bold";
const CARD_LABEL = "text-xs font-semibold tracking-wide text-foreground-subtle uppercase";

/** Métrica do card de campanha: régua com divisores; zero fica mudo (o olho vai ao que tem valor). */
function CampMetric({ label, value, destaque }: { label: string; value: number; destaque?: boolean }) {
  return (
    <div className="min-w-0 flex-1 px-4 first:pl-0 last:pr-0">
      <dt className="text-xs text-foreground-subtle">{label}</dt>
      <dd
        className={`mt-1 font-display text-h4 leading-none font-bold tabular-nums ${
          value === 0 ? "text-foreground-subtle" : destaque ? "text-success" : "text-foreground"
        }`}
      >
        {fmtInt(value)}
      </dd>
    </div>
  );
}

/** Visão geral do console: resultado primeiro, depois campanhas, contatos e operação. */
export default async function OutboundOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const now = new Date();
  const env = getOutboundEnv();

  const hasData = data.contacts.length > 0 || data.sends.length > 0 || data.enrollments.length > 0;
  const subtitle = isDemo
    ? "Simulação de demonstração. Nada aqui foi enviado de verdade."
    : "Resultado e operação das campanhas de e-mail.";

  // ── Estado vazio global: convite à ação com os comandos exatos ─────────────
  if (!hasData) {
    return (
      <ConsoleShell
        active="visao-geral"
        data={data}
        title="Visão geral"
        subtitle={subtitle}
        sessionEmail={session.email}
      >
        <div className="flex flex-col gap-8">
          <section aria-labelledby="comece-title">
            <Card padding="md" className="max-w-3xl">
              <h2 id="comece-title" className={SECTION_TITLE}>
                Comece pela primeira lista
              </h2>
              <p className="mt-2 text-small text-foreground-muted">
                O console acompanha tudo daqui em diante — três passos até os primeiros números reais.
              </p>
              <ol className="mt-5 flex flex-col gap-4 text-small">
                <li>
                  <p className="font-semibold text-foreground">1. Importe a lista do Clay</p>
                  <p className="mt-1">
                    <Code>pnpm outbound:import --file lista.xlsx --origin &quot;Clay run X&quot;</Code>
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-foreground">2. Verifique os e-mails (só &quot;ok&quot; entra)</p>
                  <p className="mt-1">
                    <Code>pnpm outbound:verify --export para-verificar.csv</Code> → verificador externo →{" "}
                    <Code>pnpm outbound:verify --results resultado.csv</Code>
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-foreground">3. Aprove a copy e inscreva os contatos</p>
                  <p className="mt-1">
                    <Code>pnpm outbound:campaign approve --slug {"<slug>"} --by &quot;Rafael&quot; --confirm</Code> e
                    depois <Code>pnpm outbound:campaign enroll --slug {"<slug>"}</Code>
                  </p>
                </li>
              </ol>
              <p className="mt-5 border-t border-border pt-4 text-small text-foreground-muted">
                {isDemo ? (
                  <>
                    O store de demonstração está vazio — rode <Code>pnpm outbound:demo</Code> e recarregue esta página.
                  </>
                ) : (
                  <>
                    Quer ver o console funcionando antes da primeira lista? Rode <Code>pnpm outbound:demo</Code> e
                    depois abra{" "}
                    <Link
                      href="/interno/outbound?demo=1"
                      className="font-semibold text-brand-strong underline underline-offset-2"
                    >
                      /interno/outbound?demo=1
                    </Link>
                    .
                  </>
                )}
              </p>
            </Card>
          </section>

          <section aria-labelledby="campanhas-def-title">
            <h2 id="campanhas-def-title" className={SECTION_TITLE}>
              Campanhas definidas
            </h2>
            <p className="mt-1 text-small text-foreground-muted">
              A copy vive versionada em <Code>src/content/outbound</Code> — revise cada campanha no detalhe.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {data.defs.map((def) => {
                const runtime = data.runtimes.find((r) => r.slug === def.slug);
                return (
                  <li
                    key={def.slug}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-small"
                  >
                    <Link
                      href={consoleHref(`/interno/outbound/${def.slug}`, isDemo)}
                      className="font-semibold text-foreground hover:text-brand-strong"
                    >
                      {def.industria}
                    </Link>
                    <span className="text-xs text-foreground-subtle">
                      {def.slug} · {ANCHOR_LABELS[def.anchor]}
                    </span>
                    <CampaignStatusChip status={campaignDisplayStatus(def, runtime)} />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </ConsoleShell>
    );
  }

  // ── Agregações ─────────────────────────────────────────────────────────────
  const rails = evaluateGuardRails(data.sends);
  const delivered = data.sends.filter((s) => s.status === "delivered").length;
  const scheduled = data.sends.filter((s) => s.status === "scheduled").length;
  const pendings = data.sends.filter((s) => s.status === "pending").length;
  const interested = data.replies.filter((r) => r.classification === "interested").length;
  // Mesma fórmula da aba Respostas: ooo não conta como resposta real (PRD §14).
  const realReplies = data.replies.filter((r) => r.classification !== "ooo").length;
  const replyRate = rails.sent > 0 ? realReplies / rails.sent : null;
  const series = dailySendSeries(data.sends, SPARK_DAYS, now, env.utcOffset);
  const stats = contactStats(data.contacts);
  const supByReason = countBy(data.suppressions, (s) => s.reason);
  const cap = dailyCap(data.state, env, now);
  const usados = usedTodayCount(data.sends, now, env.utcOffset);
  const capRampa = rampCap(data.state.firstSendAt, now);
  const topIndustries = [...stats.byIndustry.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_INDUSTRIES);
  const maxIndustria = topIndustries[0]?.[1] ?? 1;
  const imports = [...data.imports].sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt));

  const cards = data.defs.map((def) => ({
    def,
    runtime: data.runtimes.find((r) => r.slug === def.slug),
    m: campaignMetrics(def.slug, data),
  }));
  // Sinal antes do ruído: campanha real (aprovada/pausada ou com atividade) ganha
  // card completo; rascunho parado vira linha compacta.
  const principais = cards.filter(
    ({ def, runtime, m }) =>
      ["aprovada", "pausada"].includes(campaignDisplayStatus(def, runtime)) || m.sent > 0 || m.enrollmentsTotal > 0,
  );
  const rascunhos = cards.filter((c) => !principais.includes(c));

  // Agenda: quantos e-mails a cadência prevê para o PRÓXIMO dia útil (aba Agenda).
  const todayKey = sendDateKey(now, env.utcOffset);
  const proximoDia = forecastCadence(
    {
      contacts: data.contacts,
      enrollments: data.enrollments,
      sends: data.sends,
      suppressions: data.suppressions,
      campaignDefs: data.defs,
      runtimes: data.runtimes,
      state: data.state,
      env,
      now,
    },
    5,
  ).days.find((d) => d.dateKey > todayKey);

  // CRM piloto: funil de valor, reuniões e briefing (PRD §29).
  const funil = valueFunnel(data);
  const reunioes = meetingStats(data.deals, data.replies);
  const tempoResposta = replyTimeStats(data.sends, data.replies);
  const lastBriefing = [...data.briefings].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];

  // Slugs presentes no store sem definição no registro (honestidade > silêncio).
  const knownSlugs = new Set(data.defs.map((c) => c.slug));
  const orphanSlugs = [...new Set([...data.enrollments, ...data.sends].map((row) => row.campaignSlug))]
    .filter((slug) => !knownSlugs.has(slug))
    .sort();

  return (
    <ConsoleShell active="visao-geral" data={data} title="Visão geral" subtitle={subtitle} sessionEmail={session.email}>
      <div className="flex flex-col gap-8">
        {/* 1. Linha de resultado — a métrica norte primeiro. */}
        <section aria-labelledby="resultado-title">
          <h2 id="resultado-title" className="sr-only">
            Resultado
          </h2>
          <Card padding="sm" className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 shadow-md">
            <dl className="flex flex-wrap gap-x-10 gap-y-5">
              <Stat
                label="Interessados"
                value={fmtInt(interested)}
                tone={interested > 0 ? "success" : "default"}
                hint={
                  <Link
                    href={consoleHref("/interno/outbound/respostas", isDemo)}
                    className="underline underline-offset-2 hover:text-brand-strong"
                  >
                    respostas classificadas como interessado
                  </Link>
                }
              />
              <Stat
                label="Reuniões"
                value={fmtInt(reunioes.geradas)}
                tone={reunioes.geradas > 0 ? "success" : "default"}
                hint={
                  <Link
                    href={consoleHref("/interno/outbound/pipeline", isDemo)}
                    className="underline underline-offset-2 hover:text-brand-strong"
                  >
                    negócios que chegaram a reunião marcada
                  </Link>
                }
              />
              <Stat
                label="Amanhã na cadência"
                value={fmtInt(proximoDia?.items.length ?? 0)}
                hint={
                  <Link
                    href={consoleHref("/interno/outbound/agenda", isDemo)}
                    className="font-semibold text-brand-strong underline underline-offset-2"
                  >
                    e-mails previstos · ver Agenda
                  </Link>
                }
              />
              <Stat
                label="Taxa de resposta"
                value={replyRate === null ? "n/d" : fmtPct(replyRate)}
                hint={
                  replyRate === null
                    ? "sem envios ainda"
                    : `${fmtInt(data.replies.length)} respostas / ${fmtInt(rails.sent)} enviados`
                }
              />
            </dl>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 border-border sm:grid-cols-4 lg:border-l lg:pl-10">
              <Metric label="Enviados" value={fmtInt(rails.sent)} />
              <Metric label="Entregues" value={fmtInt(delivered)} />
              <Metric label="Na fila" value={fmtInt(scheduled)} />
              <Metric label="Respostas" value={fmtInt(data.replies.length)} />
            </dl>
          </Card>
        </section>

        {/* 1b. Funil de valor + briefing do MORK (CRM piloto, PRD §29). */}
        <section aria-labelledby="funil-valor-title">
          <h2 id="funil-valor-title" className={SECTION_TITLE}>
            Funil de valor
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] lg:items-start">
            <Card padding="sm">
              <ValueFunnel stages={funil} />
              <p className="mt-3 border-t border-border pt-3 text-xs text-foreground-subtle tabular-nums">
                Reuniões: {plural(reunioes.geradas, "marcada")} · {plural(reunioes.realizadas, "realizada")}
                {reunioes.taxaInteressadoReuniao !== null
                  ? ` · ${fmtPct(reunioes.taxaInteressadoReuniao)} dos interessados viram reunião`
                  : ""}
                {tempoResposta
                  ? ` · 1ª resposta em ${
                      tempoResposta.medianHours < 48
                        ? `${Math.round(tempoResposta.medianHours)} h`
                        : `${Math.round(tempoResposta.medianHours / 24)} d`
                    } (mediana)`
                  : ""}
              </p>
            </Card>
            <BriefingCard
              isDemo={isDemo}
              initial={
                lastBriefing
                  ? {
                      content: lastBriefing.content,
                      label: `${fmtDateTime(lastBriefing.generatedAt)}${lastBriefing.demo ? " · exemplo" : ""}`,
                      model: lastBriefing.model,
                    }
                  : null
              }
            />
          </div>
        </section>

        {/* 2. Envios por dia. */}
        <section aria-labelledby="envios-dia-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="envios-dia-title" className={SECTION_TITLE}>
              Envios por dia
            </h2>
            <p className="text-xs text-foreground-subtle">últimos {SPARK_DAYS} dias · bounce em vermelho</p>
          </div>
          <Card padding="sm" className="mt-3">
            <DailySendSparkline points={series} />
          </Card>
        </section>

        {/* 3. Campanhas. */}
        <section aria-labelledby="campanhas-title">
          <h2 id="campanhas-title" className={SECTION_TITLE}>
            Campanhas
          </h2>
          {cards.length === 0 ? (
            <p className="mt-3 text-small text-foreground-muted">
              Nenhuma campanha definida em <Code>src/content/outbound</Code>.
            </p>
          ) : (
            <>
              {principais.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {principais.map(({ def, runtime, m }) => (
                    <Card key={def.slug} as="article" padding="sm" interactive className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-body leading-snug font-bold">
                            {/* O link se estica sobre o card inteiro: a superfície que levanta é clicável. */}
                            <Link
                              href={consoleHref(`/interno/outbound/${def.slug}`, isDemo)}
                              className="after:absolute after:inset-0 hover:text-brand-strong"
                            >
                              {def.industria}
                            </Link>
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-foreground-subtle">
                            {def.slug} · {ANCHOR_LABELS[def.anchor]}
                          </p>
                        </div>
                        <CampaignStatusChip status={campaignDisplayStatus(def, runtime)} />
                      </div>

                      {/* Régua de métricas: divisores hairline, zeros mudos, verde só no que vale. */}
                      <dl className="flex divide-x divide-border">
                        <CampMetric label="Enviados" value={m.sent} />
                        <CampMetric label="Entregues" value={m.delivered} />
                        <CampMetric label="Respostas" value={m.repliesTotal} />
                        <CampMetric label="Interessados" value={m.interested} destaque />
                      </dl>

                      {/* Inscritos: barra fina honesta (ativos sobre o total). */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-foreground-subtle tabular-nums">
                          <span>
                            {fmtInt(m.enrollmentsActive)} de {fmtInt(m.enrollmentsTotal)} inscritos ativos
                          </span>
                          <span>
                            {fmtInt(m.scheduled)} na fila · {fmtInt(m.unsubscribes)} descadastros
                          </span>
                        </div>
                        <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-background-secondary">
                          <div
                            className="h-full rounded-full bg-brand-strong/70"
                            style={{
                              width: `${
                                m.enrollmentsTotal > 0
                                  ? Math.max(
                                      (m.enrollmentsActive / m.enrollmentsTotal) * 100,
                                      m.enrollmentsActive > 0 ? 2 : 0,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-foreground-subtle tabular-nums">
                        bounce{" "}
                        {m.rails.sent > 0
                          ? `${fmtPct(m.rails.bounceRate)} (${fmtInt(m.rails.bounced)} de ${fmtInt(m.rails.sent)})`
                          : "sem amostra ainda"}{" "}
                        · abertos* {fmtInt(m.opened)}
                      </p>
                      {m.repliesTotal > 0 ? (
                        <p className="text-xs text-foreground-subtle">
                          Respostas:{" "}
                          {[...m.repliesByClass.entries()]
                            .sort((a, b) => b[1] - a[1])
                            .map(([cls, n]) => `${REPLY_CLASS_LABELS[cls]} ${fmtInt(n)}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {m.pending > 0 ? (
                        <p className="text-xs font-semibold text-error">
                          {plural(m.pending, "envio pendente", "envios pendentes")}. Resolva antes do próximo disparo.
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </div>
              ) : null}

              {/* Rascunhos parados: linhas compactas (não competem com a campanha real). */}
              {rascunhos.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                  <p className="border-b border-border px-4 py-2 text-xs font-semibold tracking-wide text-foreground-subtle uppercase">
                    Rascunhos ({fmtInt(rascunhos.length)})
                  </p>
                  <ul>
                    {rascunhos.map(({ def, runtime }) => (
                      <li
                        key={def.slug}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 text-small transition-colors duration-(--duration-fast) first:border-t-0 hover:bg-surface-hover"
                      >
                        <Link
                          href={consoleHref(`/interno/outbound/${def.slug}`, isDemo)}
                          className="font-semibold text-foreground underline-offset-2 hover:text-brand-strong hover:underline"
                        >
                          {def.industria}
                        </Link>
                        <span className="min-w-0 truncate text-xs text-foreground-subtle">
                          {def.slug} · {ANCHOR_LABELS[def.anchor]}
                        </span>
                        <span className="ml-auto">
                          <CampaignStatusChip status={campaignDisplayStatus(def, runtime)} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
          <div className="mt-3">
            <OpenRateNote />
          </div>
          {orphanSlugs.length > 0 ? (
            <p className="mt-3 text-xs text-warning">
              Atenção: o store contém dados de campanhas sem definição no registro ({orphanSlugs.join(", ")}) —
              verifique <Code>src/content/outbound</Code>.
            </p>
          ) : null}
        </section>

        {/* 4. Contatos. */}
        <section aria-labelledby="contatos-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="contatos-title" className={SECTION_TITLE}>
              Contatos
            </h2>
            <Link
              href={consoleHref("/interno/outbound/contatos", isDemo)}
              className="text-small font-semibold text-brand-strong hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          {/* Painel de colunas divididas por hairline: cada bloco tem trilho e alinhamento próprios. */}
          <Card padding="none" className="mt-3">
            <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-[minmax(9rem,1fr)_1.1fr_1.1fr_1.5fr] lg:divide-x lg:divide-y-0">
              <dl className="p-5">
                <Stat label="Total na base" value={fmtInt(stats.total)} hint="contatos importados do Clay" />
              </dl>
              <div className="p-5">
                <h3 className={CARD_LABEL}>Por status</h3>
                <dl className="mt-2.5">
                  {CONTACT_STATUSES.map((status) => (
                    <div
                      key={status}
                      className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 text-small last:border-b-0"
                    >
                      <dt className="text-foreground-muted">{CONTACT_STATUS_LABELS[status]}</dt>
                      <dd
                        className={`font-semibold tabular-nums ${
                          stats.byStatus[status] === 0 ? "text-foreground-subtle" : "text-foreground"
                        }`}
                      >
                        {fmtInt(stats.byStatus[status])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="p-5">
                <h3 className={CARD_LABEL}>Por verificação</h3>
                <dl className="mt-2.5">
                  {VERIFICATION_STATUSES.map((status) => (
                    <div
                      key={status}
                      className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 text-small last:border-b-0"
                    >
                      <dt className="text-foreground-muted">{VERIFICATION_LABELS[status]}</dt>
                      <dd
                        className={`font-semibold tabular-nums ${
                          stats.byVerification[status] === 0 ? "text-foreground-subtle" : "text-foreground"
                        }`}
                      >
                        {fmtInt(stats.byVerification[status])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="p-5">
                <h3 className={CARD_LABEL}>Top indústrias</h3>
                {topIndustries.length > 0 ? (
                  // ul/li (não dl): a barra e a linha aninhadas quebrariam a regra dlitem do axe.
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {topIndustries.map(([industria, n]) => (
                      <li key={industria}>
                        <div className="flex items-baseline justify-between gap-4 text-small">
                          <span className="min-w-0 truncate text-foreground-muted" title={industria}>
                            {industria}
                          </span>
                          <span className="font-semibold text-foreground tabular-nums">{fmtInt(n)}</span>
                        </div>
                        <div aria-hidden className="mt-1 h-1 overflow-hidden rounded-full bg-background-secondary">
                          <div
                            className="h-full rounded-full bg-foreground-subtle/50"
                            style={{ width: `${Math.max((n / maxIndustria) * 100, 3)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-foreground-subtle">Nenhuma indústria registrada.</p>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* 5. Operação. */}
        <section aria-labelledby="operacao-title">
          <h2 id="operacao-title" className={SECTION_TITLE}>
            Operação
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card padding="sm" className="flex flex-col gap-2">
              <h3 className={CARD_LABEL}>Automação</h3>
              <div className="flex items-center justify-between gap-3">
                <Chip tone={data.state.armed ? "success" : "neutral"}>{data.state.armed ? "armada" : "desarmada"}</Chip>
                {data.state.armed ? (
                  <form action={disarmAction}>
                    {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                    <Button type="submit" variant="secondary" size="sm" className="min-h-8 px-3.5 py-1 text-xs">
                      Desarmar
                    </Button>
                  </form>
                ) : null}
              </div>
              <p className="text-xs text-foreground-subtle">
                {data.state.armed ? (
                  <>
                    {data.state.armedAt ? `Armada em ${fmtDateTime(data.state.armedAt)}. ` : null}Desarmar pelo console
                    é imediato e sempre seguro.
                  </>
                ) : (
                  <>
                    Armar é sempre pela CLI: <Code>pnpm outbound:arm arm --confirm</Code> (PRD §20).
                  </>
                )}
              </p>
              {pendings > 0 ? (
                <p className="text-xs font-semibold text-error">
                  {plural(pendings, "envio pendente", "envios pendentes")}. Resolva com{" "}
                  <Code>pnpm outbound:send --resolve-pending</Code> antes de qualquer envio.
                </p>
              ) : null}
            </Card>

            <Card padding="sm" className="flex flex-col gap-2">
              <h3 className={CARD_LABEL}>Circuit breaker</h3>
              <div>
                <Chip tone={data.state.breakerTrippedAt ? "error" : "success"}>
                  {data.state.breakerTrippedAt ? "disparado" : "ok"}
                </Chip>
              </div>
              <p className="text-xs text-foreground-subtle">
                {data.state.breakerTrippedAt ? (
                  <>
                    {data.state.breakerReason ?? "sem motivo registrado"} · desde{" "}
                    {fmtDateTime(data.state.breakerTrippedAt)} · religar:{" "}
                    <Code>pnpm outbound:arm reset-breaker --confirm</Code>
                  </>
                ) : (
                  "Pausa automática por complaint ou bounce fora da faixa (PRD §21)."
                )}
              </p>
            </Card>

            <Card padding="sm" className="flex flex-col gap-2">
              <h3 className={CARD_LABEL}>Cap e rampa</h3>
              <p className="font-display text-h4 font-bold tabular-nums">
                {fmtInt(usados)}
                <span className="text-foreground-subtle">/{fmtInt(cap)}</span>{" "}
                <span className="font-sans text-xs font-normal text-foreground-subtle">envios hoje</span>
              </p>
              <p className="text-xs text-foreground-subtle">
                {data.state.dailyCapOverride !== undefined
                  ? `Override manual (rampa daria ${fmtInt(capRampa)}/dia).`
                  : data.state.firstSendAt
                    ? `Rampa desde o 1º envio em ${fmtDate(data.state.firstSendAt)} (PRD §17).`
                    : "Rampa não iniciada — o 1º envio real define a base (PRD §17)."}
              </p>
            </Card>

            <Card padding="sm" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={CARD_LABEL}>Supressões</h3>
                <Link
                  href={consoleHref("/interno/outbound/supressao", isDemo)}
                  className="text-xs font-semibold text-brand-strong hover:underline"
                >
                  Ver lista →
                </Link>
              </div>
              <p className="font-display text-h4 font-bold tabular-nums">{fmtInt(data.suppressions.length)}</p>
              {data.suppressions.length > 0 ? (
                <dl className="flex flex-col gap-1 text-xs text-foreground-muted">
                  {[...supByReason.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, n]) => (
                      <div key={reason} className="flex justify-between gap-3">
                        <dt>{SUPPRESSION_REASON_LABELS[reason as SuppressionReason] ?? reason}</dt>
                        <dd className="font-semibold tabular-nums">{fmtInt(n)}</dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p className="text-xs text-foreground-subtle">Nenhum e-mail suprimido até agora.</p>
              )}
            </Card>

            <Card padding="sm" className="flex flex-col gap-2 sm:col-span-2">
              <h3 className={CARD_LABEL}>Lotes importados</h3>
              {imports.length === 0 ? (
                <p className="text-xs text-foreground-subtle">
                  Nenhum lote importado —{" "}
                  <Code>pnpm outbound:import --file lista.xlsx --origin &quot;Clay run X&quot;</Code>.
                </p>
              ) : (
                <div tabIndex={0} role="region" aria-label="Lotes importados" className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-small">
                    <thead>
                      <tr className="border-b border-border text-left text-xs tracking-wide text-foreground-subtle uppercase">
                        <th scope="col" className="py-1.5 pr-4 font-semibold">
                          Arquivo
                        </th>
                        <th scope="col" className="py-1.5 pr-4 font-semibold">
                          Origem
                        </th>
                        <th scope="col" className="py-1.5 pr-4 font-semibold">
                          Quando
                        </th>
                        <th scope="col" className="py-1.5 text-right font-semibold">
                          Importados
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {imports.map((batch) => (
                        <tr key={batch.id} className="border-b border-border last:border-b-0">
                          <td className="py-1.5 pr-4 font-medium text-foreground">{batch.file}</td>
                          <td className="max-w-[16rem] truncate py-1.5 pr-4 text-foreground-muted" title={batch.origin}>
                            {batch.origin}
                          </td>
                          <td className="py-1.5 pr-4 whitespace-nowrap text-foreground-muted tabular-nums">
                            {fmtDate(batch.importedAt)}
                          </td>
                          <td className="py-1.5 text-right text-foreground tabular-nums">
                            {fmtInt(batch.imported)}
                            <span className="text-foreground-subtle">/{fmtInt(batch.rows)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}
