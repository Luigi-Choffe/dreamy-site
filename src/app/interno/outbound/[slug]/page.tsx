import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IS_PRODUCTION_SITE } from "@/config/env";
import { evaluateGuardRails } from "@/lib/outbound/guardrails";
import { stepFunnel } from "@/lib/outbound/metrics";
import { campaignContentHash } from "@/lib/outbound/render";
import type { StopReason } from "@/lib/outbound/types";
import { pauseCampaignAction, resumeCampaignAction } from "../actions";
import { demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConsoleShell } from "../shell";
import {
  ANCHOR_LABELS,
  BounceChip,
  CampaignStatusChip,
  campaignDisplayStatus,
  Chip,
  Code,
  ContactCell,
  countBy,
  EmptyState,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_TONES,
  fmtDateTime,
  fmtInt,
  type FunnelStepData,
  OpenRateNote,
  REPLY_CLASS_LABELS,
  REPLY_CLASS_TONES,
  StepFunnel,
  STOP_REASON_LABELS,
} from "../ui";
import { SAMPLE_CONTACT, StepCopyPreview } from "./ui-local";

interface Params {
  slug: string;
}

/** Sempre dinâmico: lê o store local (`.outbound/` ou `.outbound-demo/`) a cada request. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Outbound · ${slug} · interno`,
    robots: { index: false, follow: false },
  };
}

const ACTIVITY_LIMIT = 50;

const thClass = "px-4 py-2 text-xs font-semibold tracking-wider text-foreground-subtle uppercase";

/**
 * Detalhe da campanha: status e ações (pausar/retomar), prévia da copy (onde o
 * usuário revisa antes de aprovar), funil por passo, guard-rails, atividade e
 * respostas — PRD-EMAIL-OUTBOUND §16/§28.
 */
export default async function OutboundCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  // V1 é 100% local (sem deploy). A versão em produção só chega junto com a auth
  // do dashboard (senha de time + cookie assinado + guard) — PRD-EMAIL-OUTBOUND §16.
  if (IS_PRODUCTION_SITE) notFound();

  const { slug } = await params;
  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);

  const campaign = data.defs.find((c) => c.slug === slug);
  if (!campaign) notFound();

  const runtime = data.runtimes.find((r) => r.slug === slug);
  const status = campaignDisplayStatus(campaign, runtime);
  const isPaused = Boolean(runtime?.pausedAt);

  const campaignEnrollments = data.enrollments.filter((e) => e.campaignSlug === slug);
  const campaignSends = data.sends.filter((s) => s.campaignSlug === slug);
  const campaignReplies = data.replies
    .filter((r) => r.campaignSlug === slug)
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(0, ACTIVITY_LIMIT);
  const recentEvents = data.events
    .filter((e) => e.campaignSlug === slug)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, ACTIVITY_LIMIT);

  const contactsById = new Map(data.contacts.map((c) => [c.id, c]));
  const sendsById = new Map(campaignSends.map((s) => [s.id, s]));

  // Aprovação é do CONTEÚDO: copy editada depois do approve invalida o hash e o
  // motor recusa enviar — a página avisa em vez de fingir que está tudo certo.
  const contentHash = campaignContentHash(campaign);
  const approvalStale = Boolean(runtime?.approvedAt) && runtime?.approvedHash !== contentHash;

  // Pausada mas com agendados remanescentes no Resend = cancelamento falhou
  // (sem OUTBOUND_RESEND_API_KEY, ou erro na API) — os e-mails ainda vão sair.
  const scheduledLeft = campaignSends.filter((s) => s.status === "scheduled").length;
  const scheduledOrphans = isPaused && scheduledLeft > 0;

  const funnel: FunnelStepData[] = stepFunnel(campaign, {
    sends: data.sends,
    enrollments: data.enrollments,
    replies: data.replies,
  }).map((row, idx) => ({
    stepId: row.stepId,
    subject: campaign.steps[idx]?.subject ?? row.stepId,
    planejados: row.planned,
    enviados: row.sent,
    entregues: row.delivered,
    abertos: row.opened,
    cliques: row.clicked,
    respostas: row.replies,
  }));

  const guard = evaluateGuardRails(data.sends, slug);
  const stopsByReason = countBy(
    campaignEnrollments.filter((e) => e.stopReason),
    (e) => e.stopReason,
  );
  const canceledSends = campaignSends.filter((s) => s.status === "canceled").length;
  const failedSends = campaignSends.filter((s) => s.status === "failed").length;
  const hasStops = stopsByReason.size > 0 || canceledSends > 0 || failedSends > 0;

  const headerExtra = isPaused ? (
    <form action={resumeCampaignAction} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={campaign.slug} />
      {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
      <Button type="submit" variant="secondary" size="sm">
        Retomar campanha
      </Button>
    </form>
  ) : (
    <form action={pauseCampaignAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="slug" value={campaign.slug} />
      {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
      <label htmlFor="pause-reason" className="sr-only">
        Motivo da pausa
      </label>
      <input
        id="pause-reason"
        name="reason"
        type="text"
        placeholder="motivo (opcional)"
        className="min-h-10 w-44 rounded-full border border-border bg-surface px-4 text-small text-foreground placeholder:text-foreground-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="border-error/50 text-error hover:border-error/70 hover:bg-error-soft"
      >
        Pausar campanha
      </Button>
    </form>
  );

  return (
    <ConsoleShell
      active="campanha"
      data={data}
      title={campaign.industria}
      subtitle={`${campaign.slug} · âncora: ${ANCHOR_LABELS[campaign.anchor]} · ${fmtInt(campaignEnrollments.length)} contatos inscritos`}
      headerExtra={headerExtra}
    >
      <div className="flex flex-col gap-10">
        <section aria-label="Status da campanha" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusChip status={status} />
            {runtime?.approvedAt ? (
              <Chip tone={approvalStale ? "warning" : "success"}>
                aprovada em {fmtDateTime(runtime.approvedAt)}
                {runtime.approvedBy ? ` por ${runtime.approvedBy}` : ""}
              </Chip>
            ) : null}
            {runtime?.pausedAt ? (
              <Chip tone="warning">
                pausada em {fmtDateTime(runtime.pausedAt)}
                {runtime.pausedReason ? ` — ${runtime.pausedReason}` : ""}
              </Chip>
            ) : null}
          </div>
          {campaign.notes ? <p className="measure text-xs text-foreground-subtle">{campaign.notes}</p> : null}

          {approvalStale ? (
            <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-small text-foreground">
              <span className="font-semibold text-warning">Copy mudou desde a aprovação</span> — o motor não envia até
              novo approve. Revise a prévia abaixo e rode{" "}
              <Code>pnpm outbound:campaign approve --slug {campaign.slug} --by &quot;seu nome&quot; --confirm</Code>.
            </div>
          ) : null}

          {scheduledOrphans ? (
            <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-small text-foreground">
              <span className="font-semibold text-warning">
                {fmtInt(scheduledLeft)} e-mail{scheduledLeft === 1 ? "" : "s"} ainda agendado
                {scheduledLeft === 1 ? "" : "s"} no Resend
              </span>{" "}
              — a campanha está pausada, mas o cancelamento não foi concluído (falha na API ou{" "}
              <Code>OUTBOUND_RESEND_API_KEY</Code> ausente). Defina a chave e pause de novo, ou cancele no painel do
              Resend antes que os envios saiam.
            </div>
          ) : null}
        </section>

        <section aria-labelledby="funil-title">
          <h2 id="funil-title" className="font-display text-h4 font-bold">
            Funil por passo
          </h2>
          {campaignEnrollments.length === 0 && campaignSends.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                Nenhum contato inscrito nesta campanha ainda — inscreva com{" "}
                <Code>pnpm outbound:campaign enroll --slug {campaign.slug}</Code> e o funil aparece após o primeiro{" "}
                <Code>pnpm outbound:plan</Code>.
              </EmptyState>
            </div>
          ) : (
            <div className="mt-4">
              <StepFunnel steps={funnel} />
            </div>
          )}
        </section>

        <section aria-labelledby="copy-title">
          <h2 id="copy-title" className="font-display text-h4 font-bold">
            Prévia da copy
          </h2>
          <p className="mt-1 text-small text-foreground-muted">
            Cada passo como o prospect verá, com amostra {SAMPLE_CONTACT.nome} · {SAMPLE_CONTACT.empresa} ·{" "}
            {SAMPLE_CONTACT.cargo}. Revise aqui antes de aprovar — erros de lint bloqueiam o envio.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {campaign.steps.map((step, idx) => (
              <StepCopyPreview
                key={step.id}
                step={step}
                isFirst={idx === 0}
                industria={campaign.industria}
                sampleCustom={campaign.sampleCustom}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="guardrails-title">
          <h2 id="guardrails-title" className="font-display text-h4 font-bold">
            Guard-rails
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card padding="sm" className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">
                Envios considerados
              </h3>
              <p className="font-display text-h4 font-bold tabular-nums">{fmtInt(guard.sent)}</p>
              <p className="text-xs text-foreground-subtle">Base das taxas (exclui cancelados e falhos).</p>
            </Card>

            <Card padding="sm" className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Bounce</h3>
              <div className="flex items-center gap-2">
                <BounceChip rate={guard.bounceRate} sample={guard.sent} />
                <span className="text-xs text-foreground-muted tabular-nums">
                  {fmtInt(guard.bounced)} de {fmtInt(guard.sent)}
                </span>
              </div>
              {guard.bounceTripped ? (
                <p className="text-xs text-error">
                  Limite de 3% atingido — pausar a campanha e cancelar agendados (PRD §21).
                </p>
              ) : (
                <p className="text-xs text-foreground-subtle">Verde &lt; 2% · âmbar 2–3% · vermelho &gt; 3%.</p>
              )}
            </Card>

            <Card padding="sm" className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Complaints</h3>
              <div>
                <Chip tone={guard.complaintTripped ? "error" : "success"}>{fmtInt(guard.complained)}</Chip>
              </div>
              <p className={guard.complaintTripped ? "text-xs text-error" : "text-xs text-foreground-subtle"}>
                {guard.complaintTripped
                  ? "Complaint registrado — breaker global; religar exige ação humana (PRD §21)."
                  : "Qualquer complaint dispara o breaker global (PRD §21)."}
              </p>
            </Card>

            <Card padding="sm" className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Paradas e pulos</h3>
              {hasStops ? (
                <dl className="flex flex-col gap-1 text-xs text-foreground-muted">
                  {[...stopsByReason.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, n]) => (
                      <div key={reason} className="flex justify-between gap-3">
                        <dt>{STOP_REASON_LABELS[reason as StopReason] ?? reason}</dt>
                        <dd className="font-semibold tabular-nums">{fmtInt(n)}</dd>
                      </div>
                    ))}
                  {canceledSends > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt>envios cancelados</dt>
                      <dd className="font-semibold tabular-nums">{fmtInt(canceledSends)}</dd>
                    </div>
                  ) : null}
                  {failedSends > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt>envios falhos</dt>
                      <dd className="font-semibold tabular-nums">{fmtInt(failedSends)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="text-xs text-foreground-subtle">Nenhuma parada registrada.</p>
              )}
            </Card>
          </div>
        </section>

        <section aria-labelledby="atividades-title">
          <h2 id="atividades-title" className="font-display text-h4 font-bold">
            Últimas atividades{" "}
            <span className="font-sans text-xs font-normal text-foreground-subtle">
              (máx. {fmtInt(ACTIVITY_LIMIT)})
            </span>
          </h2>
          {recentEvents.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                Nenhum evento registrado ainda — o polling da API do Resend (<Code>pnpm outbound:sync</Code>) alimenta
                esta lista.
              </EmptyState>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Atividades da campanha"
              className="mt-4 overflow-x-auto rounded-lg border border-border"
            >
              <table className="w-full min-w-[38rem] border-collapse text-small">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/60 text-left">
                    <th scope="col" className={thClass}>
                      Evento
                    </th>
                    <th scope="col" className={thClass}>
                      Passo
                    </th>
                    <th scope="col" className={thClass}>
                      Contato
                    </th>
                    <th scope="col" className={thClass}>
                      Quando
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((event) => {
                    const send = sendsById.get(event.sendId);
                    const contact = send ? contactsById.get(send.contactId) : undefined;
                    return (
                      <tr key={event.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2">
                          <Chip tone={EVENT_TYPE_TONES[event.type] ?? "neutral"}>
                            {EVENT_TYPE_LABELS[event.type] ?? event.type}
                          </Chip>
                        </td>
                        <td className="px-4 py-2 text-foreground-muted uppercase">{send?.stepId ?? "—"}</td>
                        <td className="px-4 py-2">{contact ? <ContactCell contact={contact} /> : "—"}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-foreground-muted tabular-nums">
                          {fmtDateTime(event.occurredAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="respostas-title">
          <h2 id="respostas-title" className="font-display text-h4 font-bold">
            Respostas{" "}
            <span className="font-sans text-xs font-normal text-foreground-subtle">
              (máx. {fmtInt(ACTIVITY_LIMIT)})
            </span>
          </h2>
          {campaignReplies.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                Nenhuma resposta registrada — registre com <Code>pnpm outbound:reply</Code> ou pela aba Respostas.
              </EmptyState>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Respostas da campanha"
              className="mt-4 overflow-x-auto rounded-lg border border-border"
            >
              <table className="w-full min-w-[38rem] border-collapse text-small">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/60 text-left">
                    <th scope="col" className={thClass}>
                      Contato
                    </th>
                    <th scope="col" className={thClass}>
                      Classe
                    </th>
                    <th scope="col" className={thClass}>
                      Recebida
                    </th>
                    <th scope="col" className={thClass}>
                      Notas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaignReplies.map((reply) => {
                    const contact = contactsById.get(reply.contactId);
                    return (
                      <tr key={reply.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2">{contact ? <ContactCell contact={contact} /> : "—"}</td>
                        <td className="px-4 py-2">
                          <Chip tone={REPLY_CLASS_TONES[reply.classification] ?? "neutral"}>
                            {REPLY_CLASS_LABELS[reply.classification] ?? reply.classification}
                          </Chip>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-foreground-muted tabular-nums">
                          {fmtDateTime(reply.receivedAt)}
                        </td>
                        <td className="px-4 py-2 text-foreground-muted">{reply.notes ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <OpenRateNote />
      </div>
    </ConsoleShell>
  );
}
