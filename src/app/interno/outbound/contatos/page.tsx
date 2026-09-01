import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/outbound/auth";
import { contactStats } from "@/lib/outbound/metrics";
import type { ContactStatus, SendRecord, VerificationStatus } from "@/lib/outbound/types";
import { suppressContactAction } from "../actions";
import { consoleHref, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConfirmSubmit } from "../pending";
import { ConsoleShell } from "../shell";
import {
  Chip,
  type ChipTone,
  Code,
  CONTACT_STATUS_LABELS,
  ContactCell,
  EmptyState,
  fmtInt,
  Metric,
  Quando,
  VERIFICATION_LABELS,
} from "../ui";
import { FiltroSelect } from "./filtros";

/** Sempre dinâmico: lê o store local (`.outbound/` ou demo) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contatos · outbound · interno",
  robots: { index: false, follow: false },
};

/** Página cresce de 100 em 100 pelo "Mostrar mais" (?limite=), com teto de sanidade. */
const LIMITE_PASSO = 100;
const LIMITE_TETO = 2000;
const SEM_INDUSTRIA = "(sem indústria)";

/** Ordenações clicáveis da tabela (?ordem=, sufixo -desc inverte). */
const ORDENS = ["empresa", "verificacao", "ultimo_envio"] as const;
type Ordem = (typeof ORDENS)[number];

/** Asc = saudável primeiro; desc responde "quem está sujo?" num clique. */
const VERIF_RANK: Record<VerificationStatus, number> = { ok: 0, risky: 1, invalid: 2, unverified: 3 };

const CONTACT_STATUSES: ContactStatus[] = ["active", "excluded", "suppressed"];
const VERIFICATION_STATUSES: VerificationStatus[] = ["ok", "risky", "invalid", "unverified"];

/** Chips por linha (singular — os rótulos de `ui.tsx` são agregados/plurais). */
const STATUS_ROW: Record<ContactStatus, { label: string; tone: ChipTone }> = {
  // O caso comum é mudo: verde nas linhas ficaria repetido 100 vezes (verde = exceção boa).
  active: { label: "ativo", tone: "neutral" },
  excluded: { label: "excluído", tone: "neutral" },
  suppressed: { label: "suprimido", tone: "error" },
};

const VERIFICATION_ROW: Record<VerificationStatus, { label: string; tone: ChipTone }> = {
  ok: { label: "ok", tone: "neutral" },
  risky: { label: "arriscado", tone: "warning" },
  invalid: { label: "inválido", tone: "error" },
  unverified: { label: "não verificado", tone: "outline" },
};

const SEND_STATUS_LABELS: Record<SendRecord["status"], string> = {
  pending: "pendente",
  scheduled: "agendado",
  sent: "enviado",
  delivered: "entregue",
  bounced: "bounce",
  complained: "complaint",
  failed: "falha",
  canceled: "cancelado",
};

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-small text-foreground " +
  "placeholder:text-foreground-subtle/80 hover:border-border-strong " +
  "focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";

function param(sp: SearchParams, name: string): string {
  const value = sp[name];
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

/** Comparação case/acento-insensitive (pt-BR): "São" casa com "sao". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Referência temporal de um send para "último envio" (sentAt > scheduledAt). */
function sendRefIso(send: SendRecord): string | undefined {
  return send.sentAt ?? send.scheduledAt;
}

function sendRefTime(send: SendRecord): number {
  const iso = sendRefIso(send);
  return iso ? Date.parse(iso) : 0;
}

/** Duas iniciais da empresa (ou do nome): âncora visual da linha, sem PII nova. */
function monogram(contact: { empresa?: string; nome: string }): string {
  const base = contact.empresa?.trim() || contact.nome.trim() || "?";
  const parts = base.split(/\s+/).filter((w) => w.length > 1);
  const a = parts[0]?.[0] ?? base[0] ?? "?";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

/** Base de contatos: filtro, auditoria e supressão contato a contato. */
export default async function OutboundContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);

  const q = param(sp, "q");
  const rawStatus = param(sp, "status");
  const statusFilter = (CONTACT_STATUSES as string[]).includes(rawStatus) ? (rawStatus as ContactStatus) : "";
  const rawVerification = param(sp, "verificacao");
  const verificationFilter = (VERIFICATION_STATUSES as string[]).includes(rawVerification)
    ? (rawVerification as VerificationStatus)
    : "";
  const industriaFilter = param(sp, "industria");
  const hasFilter = Boolean(q || statusFilter || verificationFilter || industriaFilter);

  const ordemRaw = param(sp, "ordem");
  const ordemStrip = ordemRaw.endsWith("-desc") ? ordemRaw.slice(0, -5) : ordemRaw;
  const ordemCampo: Ordem = (ORDENS as readonly string[]).includes(ordemStrip) ? (ordemStrip as Ordem) : "empresa";
  const ordemDesc = ordemRaw === `${ordemCampo}-desc`;
  const limiteRaw = Number.parseInt(param(sp, "limite"), 10);
  const limite = Number.isFinite(limiteRaw) ? Math.min(Math.max(limiteRaw, LIMITE_PASSO), LIMITE_TETO) : LIMITE_PASSO;

  /** Monta href preservando filtros/ordem/demo; override com undefined remove a chave. */
  const buildHref = (overrides: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    if (isDemo) params.set("demo", "1");
    for (const [k, v] of Object.entries({
      q,
      status: statusFilter,
      verificacao: verificationFilter,
      industria: industriaFilter,
    })) {
      if (v) params.set(k, v);
    }
    if (ordemCampo !== "empresa" || ordemDesc) params.set("ordem", ordemDesc ? `${ordemCampo}-desc` : ordemCampo);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return `/interno/outbound/contatos${qs ? `?${qs}` : ""}`;
  };

  const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const industrias = [...new Set(data.contacts.map((c) => c.industria?.trim() || SEM_INDUSTRIA))].sort(
    collator.compare,
  );

  const qFold = fold(q);
  const filtered = data.contacts.filter((contact) => {
    if (statusFilter && contact.status !== statusFilter) return false;
    if (verificationFilter && contact.verification !== verificationFilter) return false;
    if (industriaFilter && (contact.industria?.trim() || SEM_INDUSTRIA) !== industriaFilter) return false;
    if (qFold) {
      // Busca por nome/empresa; o e-mail pode casar no filtro, mas nunca vira texto visível.
      const haystack = fold([contact.nome, contact.sobrenome ?? "", contact.empresa ?? "", contact.email].join(" "));
      if (!haystack.includes(qFold)) return false;
    }
    return true;
  });

  const totalStats = contactStats(data.contacts);
  const filteredStats = contactStats(filtered);

  const activeCampaignsByContact = new Map<string, string[]>();
  for (const enrollment of data.enrollments) {
    if (enrollment.status !== "active") continue;
    const list = activeCampaignsByContact.get(enrollment.contactId) ?? [];
    list.push(enrollment.campaignSlug);
    activeCampaignsByContact.set(enrollment.contactId, list);
  }

  const lastSendByContact = new Map<string, SendRecord>();
  for (const send of data.sends) {
    const t = sendRefTime(send);
    if (t === 0) continue;
    const prev = lastSendByContact.get(send.contactId);
    if (!prev || t > sendRefTime(prev)) lastSendByContact.set(send.contactId, send);
  }

  type Row = (typeof filtered)[number];
  const porEmpresa = (a: Row, b: Row) =>
    collator.compare(a.empresa ?? "", b.empresa ?? "") ||
    collator.compare(a.nome, b.nome) ||
    collator.compare(a.sobrenome ?? "", b.sobrenome ?? "");
  const ultimoEnvio = (c: Row) => {
    const send = lastSendByContact.get(c.id);
    return send ? sendRefTime(send) : 0;
  };
  const cmp =
    ordemCampo === "verificacao"
      ? (a: Row, b: Row) => VERIF_RANK[a.verification] - VERIF_RANK[b.verification] || porEmpresa(a, b)
      : ordemCampo === "ultimo_envio"
        ? (a: Row, b: Row) => ultimoEnvio(a) - ultimoEnvio(b) || porEmpresa(a, b)
        : porEmpresa;
  const sorted = [...filtered].sort(cmp);
  if (ordemDesc) sorted.reverse();
  const rows = sorted.slice(0, limite);

  const clearHref = consoleHref("/interno/outbound/contatos", isDemo);

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="contatos"
      data={data}
      title="Contatos"
      subtitle="Base importada do Clay — filtre, audite e suprima contato a contato."
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="filtros-title">
          <h2 id="filtros-title" className="sr-only">
            Filtros
          </h2>
          <form
            method="get"
            action="/interno/outbound/contatos"
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            {/* Trocar filtro preserva a ordenação e reseta o limite. */}
            {ordemCampo !== "empresa" || ordemDesc ? (
              <input type="hidden" name="ordem" value={ordemDesc ? `${ordemCampo}-desc` : ordemCampo} />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,2fr)_1fr_1fr_1fr_auto]">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="filtro-q"
                  className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase"
                >
                  Busca
                </label>
                <input
                  id="filtro-q"
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="nome ou empresa"
                  className={CONTROL_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="filtro-status"
                  className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase"
                >
                  Status
                </label>
                <FiltroSelect id="filtro-status" name="status" defaultValue={statusFilter} className={CONTROL_CLASS}>
                  <option value="">todos</option>
                  {CONTACT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {CONTACT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </FiltroSelect>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="filtro-verificacao"
                  className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase"
                >
                  Verificação
                </label>
                <FiltroSelect
                  id="filtro-verificacao"
                  name="verificacao"
                  defaultValue={verificationFilter}
                  className={CONTROL_CLASS}
                >
                  <option value="">todas</option>
                  {VERIFICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {VERIFICATION_LABELS[status]}
                    </option>
                  ))}
                </FiltroSelect>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="filtro-industria"
                  className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase"
                >
                  Indústria
                </label>
                <FiltroSelect
                  id="filtro-industria"
                  name="industria"
                  defaultValue={industriaFilter}
                  className={CONTROL_CLASS}
                >
                  <option value="">todas</option>
                  {industrias.map((industria) => (
                    <option key={industria} value={industria}>
                      {industria}
                    </option>
                  ))}
                </FiltroSelect>
              </div>
              <div className="flex items-end gap-3">
                <button
                  type="submit"
                  className="h-9 rounded-full border border-border-strong bg-transparent px-4 text-small font-semibold text-foreground transition-colors duration-(--duration-fast) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Filtrar
                </button>
                {hasFilter ? (
                  <Link href={clearHref} className="text-xs text-foreground-subtle underline hover:text-brand-strong">
                    limpar filtros
                  </Link>
                ) : null}
              </div>
            </div>
          </form>
        </section>

        <section aria-labelledby="resumo-title">
          <h2 id="resumo-title" className="sr-only">
            Resumo
          </h2>
          <Card padding="sm">
            <p className="text-small text-foreground-muted">
              <span className="font-semibold text-foreground tabular-nums">{fmtInt(filteredStats.total)}</span>
              {hasFilter ? (
                <>
                  {" "}
                  de <span className="tabular-nums">{fmtInt(totalStats.total)}</span> contatos no filtro atual.
                </>
              ) : (
                <> contatos na base.</>
              )}
            </p>
            {data.contacts.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Por status</h3>
                  <dl className="mt-2 grid grid-cols-3 gap-3">
                    {CONTACT_STATUSES.map((status) => (
                      <Metric
                        key={status}
                        label={CONTACT_STATUS_LABELS[status]}
                        value={fmtInt(filteredStats.byStatus[status])}
                        hint={hasFilter ? `de ${fmtInt(totalStats.byStatus[status])}` : undefined}
                      />
                    ))}
                  </dl>
                </div>
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">
                    Por verificação
                  </h3>
                  <dl className="mt-2 grid grid-cols-4 gap-3">
                    {VERIFICATION_STATUSES.map((status) => (
                      <Metric
                        key={status}
                        label={VERIFICATION_LABELS[status]}
                        value={fmtInt(filteredStats.byVerification[status])}
                        hint={hasFilter ? `de ${fmtInt(totalStats.byVerification[status])}` : undefined}
                      />
                    ))}
                  </dl>
                </div>
              </div>
            ) : null}
          </Card>
        </section>

        <section aria-labelledby="tabela-title">
          <h2 id="tabela-title" className="sr-only">
            Lista de contatos
          </h2>
          {data.contacts.length === 0 ? (
            <EmptyState>
              Nenhum contato importado ainda — rode{" "}
              <Code>pnpm outbound:import --file lista.xlsx --origin &quot;Clay run X&quot;</Code> para trazer a primeira
              lista.
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState>
              Nenhum contato corresponde ao filtro atual —{" "}
              <Link href={clearHref} className="font-semibold underline hover:text-brand-strong">
                limpar filtros
              </Link>
              .
            </EmptyState>
          ) : (
            <>
              <div
                tabIndex={0}
                role="region"
                aria-label="Tabela de contatos"
                className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm"
              >
                <table className="w-full min-w-[56rem] border-collapse text-small">
                  <thead>
                    <tr className="border-b border-border bg-background-secondary/60 text-left">
                      {(
                        [
                          { label: "Contato", campo: "empresa" as Ordem },
                          { label: "Cargo" },
                          { label: "Indústria" },
                          { label: "Verificação", campo: "verificacao" as Ordem },
                          { label: "Status" },
                          { label: "Campanha ativa" },
                          { label: "Último envio", campo: "ultimo_envio" as Ordem },
                        ] as Array<{ label: string; campo?: Ordem }>
                      ).map(({ label, campo }) => {
                        const ativa = campo !== undefined && campo === ordemCampo;
                        return (
                          <th
                            key={label}
                            scope="col"
                            aria-sort={ativa ? (ordemDesc ? "descending" : "ascending") : undefined}
                            className="px-3 py-2 text-xs font-semibold tracking-wider text-foreground-subtle uppercase"
                          >
                            {campo ? (
                              <Link
                                href={buildHref({
                                  ordem: ativa && !ordemDesc ? `${campo}-desc` : campo,
                                  limite: undefined,
                                })}
                                title="Ordenar por esta coluna (clique de novo para inverter)"
                                className={`inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline ${
                                  ativa ? "text-foreground" : ""
                                }`}
                              >
                                {label}
                                {ativa ? (
                                  <span aria-hidden className="text-[0.6rem]">
                                    {ordemDesc ? "↓" : "↑"}
                                  </span>
                                ) : null}
                              </Link>
                            ) : (
                              label
                            )}
                          </th>
                        );
                      })}
                      <th scope="col" className="px-3 py-2">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((contact) => {
                      const activeSlugs = activeCampaignsByContact.get(contact.id) ?? [];
                      const lastSend = lastSendByContact.get(contact.id);
                      const lastIso = lastSend ? sendRefIso(lastSend) : undefined;
                      const statusChip = STATUS_ROW[contact.status];
                      const verificationChip = VERIFICATION_ROW[contact.verification];
                      return (
                        <tr
                          key={contact.id}
                          className="border-b border-border transition-colors duration-(--duration-fast) last:border-b-0 hover:bg-surface-hover"
                        >
                          <td className="px-3 py-2">
                            <Link
                              href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
                              className="flex items-center gap-2.5 hover:text-brand-strong"
                              title="Abrir a conta do contato"
                            >
                              <span
                                aria-hidden
                                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background-secondary font-display text-[0.6rem] font-bold text-foreground-muted"
                              >
                                {monogram(contact)}
                              </span>
                              <ContactCell contact={contact} />
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-foreground-muted">
                            <span className="block max-w-[13rem] truncate" title={contact.cargo?.trim() || undefined}>
                              {contact.cargo?.trim() || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-foreground-muted">
                            <span
                              className="block max-w-[13rem] truncate"
                              title={contact.industria?.trim() || undefined}
                            >
                              {contact.industria?.trim() || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <Chip tone={verificationChip.tone}>{verificationChip.label}</Chip>
                          </td>
                          <td className="px-3 py-2">
                            <Chip tone={statusChip.tone}>{statusChip.label}</Chip>
                          </td>
                          <td className="px-3 py-2">
                            {activeSlugs.length > 0 ? (
                              <span className="flex flex-col gap-0.5">
                                {activeSlugs.map((slug) => (
                                  <Link
                                    key={slug}
                                    href={consoleHref(`/interno/outbound/${slug}`, isDemo)}
                                    className="text-xs text-foreground-muted underline-offset-2 hover:text-brand-strong hover:underline"
                                  >
                                    {slug}
                                  </Link>
                                ))}
                              </span>
                            ) : (
                              <span className="text-foreground-subtle">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-foreground-muted">
                            {lastSend && lastIso ? (
                              <>
                                {SEND_STATUS_LABELS[lastSend.status]} · <Quando iso={lastIso} />
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {contact.status !== "suppressed" ? (
                              <form action={suppressContactAction} className="inline-block">
                                <input type="hidden" name="contactId" value={contact.id} />
                                {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                                <ConfirmSubmit
                                  title="Suprimir: sai de todas as campanhas e nunca mais recebe e-mail (permanente)"
                                  confirmLabel="Confirmar supressão"
                                  className="rounded-full border border-error/40 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-error transition-colors duration-(--duration-fast) hover:bg-error-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                                >
                                  Suprimir
                                </ConfirmSubmit>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Fim dos contatos inalcançáveis: a página cresce aqui mesmo, preservando filtros e ordem. */}
                {filtered.length > rows.length ? (
                  <div className="border-t border-border bg-background-secondary/30 px-3 py-2.5 text-center text-small">
                    <Link
                      href={buildHref({ limite: String(Math.min(limite + LIMITE_PASSO, LIMITE_TETO)) })}
                      className="font-semibold text-brand-strong underline-offset-2 hover:underline"
                    >
                      Mostrar mais {fmtInt(Math.min(LIMITE_PASSO, filtered.length - rows.length))}
                    </Link>{" "}
                    <span className="text-foreground-subtle tabular-nums">
                      · exibindo {fmtInt(rows.length)} de {fmtInt(filtered.length)}
                    </span>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-foreground-subtle">
                E-mails não aparecem como texto no console (PII) — passe o mouse sobre o contato para ver no tooltip.
                Suprimir é permanente e bloqueia qualquer envio futuro; agendados no Resend são cancelados quando a
                chave está configurada (senão viram “agendados órfãos” no fio de saúde).
              </p>
            </>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
