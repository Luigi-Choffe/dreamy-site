import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Field";
import { requireSession } from "@/lib/outbound/auth";
import { getOutboundEnv } from "@/lib/outbound/config";
import { wasSent } from "@/lib/outbound/metrics";
import { replyStepId } from "@/lib/outbound/ops-core";
import type { Contact, ReplyClass } from "@/lib/outbound/types";
import { classifyReplyAction, registerReplyAction } from "../actions";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConsoleShell } from "../shell";
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
  return contact.empresa ? `${name} — ${contact.empresa}` : name;
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

  const ordered = [...replies].sort(
    (a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.recordedAt.localeCompare(a.recordedAt),
  );

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
          <Card padding="sm">
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
                className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface"
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
                      <th scope="col" className={TH}>
                        Recebida em
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
                                className="text-brand-strong hover:underline"
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
                                <button type="submit" className={BTN_SM}>
                                  Salvar
                                </button>
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
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <Card as="section" padding="sm" aria-labelledby="registrar-resposta-title">
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
              <form action={registerReplyAction} className="mt-4 flex flex-col gap-3">
                {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                <div className="flex flex-col gap-1">
                  <label htmlFor="registrar-contato" className={LABEL}>
                    Contato
                  </label>
                  {/* defaultValue vazio + required: um clique acidental no botão não pode
                      registrar resposta do 1º contato da lista (achado da revisão). */}
                  <select id="registrar-contato" name="contactId" required defaultValue="" className={CONTROL}>
                    <option value="" disabled>
                      selecione o contato…
                    </option>
                    {contactOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {contactOptionLabel(c)}
                      </option>
                    ))}
                  </select>
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
                <Checkbox id="registrar-suppress" name="suppress" value="1" label="pediu para não receber (opt-out)" />
                <div>
                  <Button type="submit" size="sm">
                    Registrar resposta
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </ConsoleShell>
  );
}
