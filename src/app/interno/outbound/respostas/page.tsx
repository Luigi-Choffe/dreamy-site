import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Field";
import { requireSession } from "@/lib/outbound/auth";
import { getOutboundEnv } from "@/lib/outbound/config";
import { wasSent } from "@/lib/outbound/metrics";
import { replyStepId } from "@/lib/outbound/ops-core";
import type { Contact, ReplyClass } from "@/lib/outbound/types";
import { classifyReplyAction } from "../actions";
import { ComboContato } from "./combo-contato";
import { TriagemIA } from "./triagem-ia";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { FormComEstado } from "../form-com-estado";
import { PendingPill, SubmitButton } from "../pending";
import { ConsoleShell } from "../shell";
import { registrarRespostaComEstado } from "../stateful-actions";
import {
  Chip,
  Code,
  ContactCell,
  countBy,
  EmptyState,
  fmtDateTime,
  fmtInt,
  fmtPct,
  REPLY_CLASS_LABELS,
  REPLY_CLASS_TONES,
} from "../ui";

/** Sempre dinâmico: lê o store local (`.outbound/` ou `.outbound-demo/`) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outbound · respostas · interno",
  robots: { index: false, follow: false },
};

/** Ordem de exibição das classes (interessado primeiro — é a métrica norte). */
const REPLY_CLASSES: ReplyClass[] = ["interested", "not_now", "referral", "negative", "ooo", "other"];

/** Limite do select de contato — acima disso, registrar via CLI. */
const CONTACT_OPTION_LIMIT = 200;

// Densidade de console: controles e células compactos, coerentes com o design system.
const TH = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-foreground-subtle uppercase";
const CONTROL =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-small text-foreground " +
  "hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";
const CONTROL_INLINE =
  "rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground " +
  "hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";
const BTN_SM =
  "rounded-full border border-border-strong bg-transparent px-3 py-1 text-xs font-semibold text-foreground " +
  "hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const LABEL = "text-xs font-semibold text-foreground";

function contactOptionLabel(contact: Contact): string {
  const name = [contact.nome, contact.sobrenome].filter(Boolean).join(" ") || "(sem nome)";
  return contact.empresa ? `${name} · ${contact.empresa}` : name;
}

/**
 * Respostas — a página da métrica norte (PRD §21): interessados viram reuniões.
 * Registro e classificação manuais (a caixa de respostas é lida por humano — §16).
 */
export default async function OutboundRepliesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);
  const { defs, contacts, enrollments, sends, replies } = data;

  const defsBySlug = new Map(defs.map((d) => [d.slug, d]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  // Métrica norte: respostas reais (sem "fora do escritório") sobre enviados de fato.
  const enviados = sends.filter(wasSent).length;
  const reais = replies.filter((r) => r.classification !== "ooo").length;
  const taxa = enviados > 0 ? reais / enviados : null;
  const byClass = countBy(replies, (r) => r.classification);
  const interessados = byClass.get("interested") ?? 0;

  // Ordenação e crescimento da lista (P2 #13 do plano): ?ordem=recebida inverte; ?limite= cresce.
  const spStr = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "";
  const ordemAsc = spStr(sp.ordem) === "recebida";
  const limiteRaw = Number.parseInt(spStr(sp.limite), 10);
  const limite = Number.isFinite(limiteRaw) ? Math.min(Math.max(limiteRaw, 50), 1000) : 50;
  const todas = [...replies].sort((a, b) =>
    ordemAsc
      ? a.receivedAt.localeCompare(b.receivedAt) || a.recordedAt.localeCompare(b.recordedAt)
      : b.receivedAt.localeCompare(a.receivedAt) || b.recordedAt.localeCompare(a.recordedAt),
  );
  const ordered = todas.slice(0, limite);

  const respostasHref = (overrides: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    if (isDemo) params.set("demo", "1");
    if (ordemAsc) params.set("ordem", "recebida");
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return `/interno/outbound/respostas${qs ? `?${qs}` : ""}`;
  };

  // Contatos elegíveis para registrar resposta: inscritos em alguma campanha.
  const enrolledIds = new Set(enrollments.map((e) => e.contactId));
  const eligible = contacts
    .filter((c) => enrolledIds.has(c.id))
    .sort((a, b) => contactOptionLabel(a).localeCompare(contactOptionLabel(b), "pt-BR"));
  const contactOptions = eligible.slice(0, CONTACT_OPTION_LIMIT);

  const replyTo = getOutboundEnv().replyTo;

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="respostas"
      data={data}
      title="Respostas"
      subtitle="A métrica norte do outbound — registre e classifique o que chegar na caixa de respostas."
    >
      <div className="flex flex-col gap-8">
        <section aria-label="Resumo de respostas" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* O herói da página: único vidro elevado com anel da marca. */}
          <Card padding="sm" className="shadow-md ring-1 ring-brand-strong/15">
            <h2 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Interessados</h2>
            <p className="mt-1 font-display text-h3 font-extrabold text-brand-strong tabular-nums">
              {fmtInt(interessados)}
            </p>
            <p className="mt-1 text-xs text-foreground-subtle">Reuniões em potencial — o número que importa.</p>
          </Card>
          <Card padding="sm">
            <h2 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Taxa de resposta</h2>
            <p className="mt-1 font-display text-h3 font-bold tabular-nums">{taxa === null ? "—" : fmtPct(taxa)}</p>
            <p className="mt-1 text-xs text-foreground-subtle">
              {enviados > 0 ? (
                <>
                  {fmtInt(reais)} respostas reais (sem fora do escritório) sobre {fmtInt(enviados)} enviados.
                </>
              ) : (
                "Sem envios ainda — a taxa aparece após o primeiro disparo."
              )}
            </p>
          </Card>
          <Card padding="sm">
            <h2 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Por classe</h2>
            {replies.length === 0 ? (
              <p className="mt-2 text-xs text-foreground-subtle">Nenhuma resposta registrada.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {REPLY_CLASSES.map((cls) => {
                  const n = byClass.get(cls) ?? 0;
                  if (n === 0) return null;
                  return (
                    <li key={cls}>
                      <Chip tone={REPLY_CLASS_TONES[cls]}>
                        {REPLY_CLASS_LABELS[cls]} <span className="tabular-nums">{fmtInt(n)}</span>
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section aria-labelledby="respostas-lista-title">
            <h2 id="respostas-lista-title" className="font-display text-h4 font-bold">
              Respostas registradas
            </h2>
            {ordered.length === 0 ? (
              <div className="mt-4">
                <EmptyState>
                  Nenhuma resposta ainda — as respostas chegam na caixa{" "}
                  {replyTo ? <Code>{replyTo}</Code> : <Code>OUTBOUND_REPLY_TO</Code>} e são registradas aqui ou via{" "}
                  <Code>pnpm outbound:reply</Code>.
                </EmptyState>
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label="Lista de respostas"
                className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface shadow-sm"
              >
                <table className="w-full min-w-[44rem] text-small">
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>
                        Contato
                      </th>
                      <th scope="col" className={TH}>
                        Campanha
                      </th>
                      <th scope="col" className={TH}>
                        Passo provável
                      </th>
                      <th scope="col" aria-sort={ordemAsc ? "ascending" : "descending"} className={TH}>
                        <Link
                          href={respostasHref({ ordem: ordemAsc ? undefined : "recebida", limite: undefined })}
                          title="Ordenar por data (clique para inverter)"
                          className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
                        >
                          Recebida em
                          <span aria-hidden className="text-[0.6rem]">
                            {ordemAsc ? "↑" : "↓"}
                          </span>
                        </Link>
                      </th>
                      <th scope="col" className={TH}>
                        Classe
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordered.map((reply) => {
                      const contact = contactsById.get(reply.contactId);
                      const def = defsBySlug.get(reply.campaignSlug);
                      const step = replyStepId(sends, reply);
                      return (
                        <Fragment key={reply.id}>
                          <tr className="border-t border-border align-top">
                            <td className="px-3 py-2">
                              {contact ? (
                                <ContactCell contact={contact} />
                              ) : (
                                <span className="text-foreground-subtle">(contato não encontrado)</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Link
                                href={consoleHref(`/interno/outbound/${reply.campaignSlug}`, isDemo)}
                                className="text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
                                title={reply.campaignSlug}
                              >
                                {def?.industria ?? reply.campaignSlug}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-foreground-muted uppercase tabular-nums">{step ?? "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-foreground-muted tabular-nums">
                              {fmtDateTime(reply.receivedAt)}
                            </td>
                            <td className="px-3 py-2">
                              <form action={classifyReplyAction} className="flex items-center gap-1.5">
                                <input type="hidden" name="replyId" value={reply.id} />
                                {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                                <label htmlFor={`classe-${reply.id}`} className="sr-only">
                                  Classe da resposta
                                </label>
                                <select
                                  id={`classe-${reply.id}`}
                                  name="classification"
                                  defaultValue={reply.classification}
                                  className={CONTROL_INLINE}
                                >
                                  {REPLY_CLASSES.map((cls) => (
                                    <option key={cls} value={cls}>
                                      {REPLY_CLASS_LABELS[cls]}
                                    </option>
                                  ))}
                                </select>
                                <PendingPill className={BTN_SM} pendingLabel="Salvando…">
                                  Salvar
                                </PendingPill>
                              </form>
                            </td>
                          </tr>
                          {reply.notes ? (
                            <tr>
                              <td colSpan={5} className="px-3 pt-0 pb-2 text-xs text-foreground-subtle">
                                {reply.notes}
                              </td>
                            </tr>
                          ) : null}
                          <tr>
                            <td colSpan={5} className="px-3 pt-0 pb-2.5">
                              <TriagemIA
                                replyId={reply.id}
                                contactId={contact?.id}
                                textoInicial={reply.notes}
                                isDemo={isDemo}
                                replyTo={replyTo}
                              />
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {todas.length > ordered.length ? (
                  <div className="border-t border-border bg-background-secondary/30 px-3 py-2.5 text-center text-small">
                    <Link
                      href={respostasHref({ limite: String(Math.min(limite + 50, 1000)) })}
                      className="font-semibold text-brand-strong underline-offset-2 hover:underline"
                    >
                      Mostrar mais {fmtInt(Math.min(50, todas.length - ordered.length))}
                    </Link>{" "}
                    <span className="text-foreground-subtle tabular-nums">
                      · exibindo {fmtInt(ordered.length)} de {fmtInt(todas.length)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <Card as="section" padding="sm" aria-labelledby="registrar-resposta-title" className="lg:sticky lg:top-6">
            <h2 id="registrar-resposta-title" className="font-display text-h4 font-bold">
              Registrar resposta
            </h2>
            <p className="mt-1 text-xs text-foreground-subtle">
              Registre aqui o que chegar na caixa de respostas
              {replyTo ? (
                <>
                  {" "}
                  (<Code>{replyTo}</Code>)
                </>
              ) : null}
              .
            </p>
            {contactOptions.length === 0 ? (
              <p className="mt-4 text-xs text-foreground-muted">
                Nenhum contato inscrito em campanha ainda — inscreva com <Code>pnpm outbound:enroll</Code>.
              </p>
            ) : (
              <FormComEstado action={registrarRespostaComEstado} resetOnOk className="mt-4 flex flex-col gap-3">
                {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                <div className="flex flex-col gap-1">
                  <label htmlFor="registrar-contato" className={LABEL}>
                    Contato
                  </label>
                  {/* Combobox (P1 #6): filtro por texto sobre o select nativo; defaultValue
                      vazio + required seguem valendo (clique acidental não registra o 1º). */}
                  <ComboContato
                    id="registrar-contato"
                    name="contactId"
                    controlClass={CONTROL}
                    options={contactOptions.map((c) => ({ value: c.id, label: contactOptionLabel(c) }))}
                  />
                  {eligible.length > contactOptions.length ? (
                    <p className="text-xs text-foreground-subtle">
                      Mostrando {fmtInt(contactOptions.length)} de {fmtInt(eligible.length)} contatos inscritos — para
                      os demais, use <Code>pnpm outbound:reply</Code>.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="registrar-classe" className={LABEL}>
                    Classe
                  </label>
                  <select id="registrar-classe" name="classification" required defaultValue="" className={CONTROL}>
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
                  <label htmlFor="registrar-notas" className={LABEL}>
                    Notas <span className="font-normal text-foreground-subtle">(opcional)</span>
                  </label>
                  <textarea
                    id="registrar-notas"
                    name="notes"
                    rows={2}
                    className={`${CONTROL} resize-y`}
                    placeholder="ex.: pediu proposta para outubro"
                  />
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-foreground-muted transition-colors duration-(--duration-fast) hover:text-foreground">
                    Registro retroativo
                  </summary>
                  <div className="mt-2 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="registrar-recebida" className={LABEL}>
                        Recebida em <span className="font-normal text-foreground-subtle">(vazio = agora)</span>
                      </label>
                      <input id="registrar-recebida" type="datetime-local" name="receivedAt" className={CONTROL} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="registrar-campanha" className={LABEL}>
                        Campanha{" "}
                        <span className="font-normal text-foreground-subtle">(se o contato não tem sequência)</span>
                      </label>
                      <select id="registrar-campanha" name="campaignSlug" defaultValue="" className={CONTROL}>
                        <option value="">automática</option>
                        {defs.map((d) => (
                          <option key={d.slug} value={d.slug}>
                            {d.industria} ({d.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </details>
                <Checkbox id="registrar-suppress" name="suppress" value="1" label="pediu para não receber (opt-out)" />
                <div>
                  <SubmitButton size="sm" loadingLabel="Registrando">
                    Registrar resposta
                  </SubmitButton>
                </div>
              </FormComEstado>
            )}
          </Card>
        </div>
      </div>
    </ConsoleShell>
  );
}
