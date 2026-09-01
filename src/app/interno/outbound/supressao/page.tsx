import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/outbound/auth";
import type { SuppressionReason } from "@/lib/outbound/types";
import { suppressContactAction } from "../actions";
import { FiltroSelect } from "../contatos/filtros";
import { demoRequested, loadDashboardData, type SearchParams } from "../data";
import { ConfirmSubmit } from "../pending";
import { ConsoleShell } from "../shell";
import { Chip, type ChipTone, Code, countBy, EmptyState, fmtInt, Quando, SUPPRESSION_REASON_LABELS } from "../ui";

/** Sempre dinâmico: lê o store local (`.outbound/` ou demo) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supressão · outbound · interno",
  robots: { index: false, follow: false },
};

const SELECT_LIMIT = 200;

/** Motivos na ordem do domínio, com explicação de uma linha cada. */
const REASONS: Array<{ reason: SuppressionReason; explain: string }> = [
  {
    reason: "unsubscribe",
    explain: "O contato pediu para não receber — opt-out registrado por resposta ou pela CLI.",
  },
  {
    reason: "hard_bounce",
    explain: "Endereço rejeitado de forma definitiva — reenviar destruiria a reputação do domínio.",
  },
  {
    reason: "complaint",
    explain: "Marcado como spam pelo destinatário — além da supressão, dispara o circuit breaker.",
  },
  {
    reason: "manual",
    explain: "Suprimido por decisão da equipe, pelo console ou pela CLI.",
  },
  {
    reason: "client",
    explain: "Já é cliente — fora do alcance da prospecção fria.",
  },
];

const REASON_TONES: Record<SuppressionReason, ChipTone> = {
  unsubscribe: "warning",
  hard_bounce: "error",
  complaint: "error",
  manual: "neutral",
  client: "brand",
};

const CONTROL =
  "h-9 rounded-md border border-border bg-surface px-3 text-small text-foreground " +
  "placeholder:text-foreground-subtle/80 hover:border-border-strong " +
  "focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";
const LABEL = "text-xs font-semibold tracking-wide text-foreground-subtle uppercase";

function param(sp: SearchParams, name: string): string {
  const value = sp[name];
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

/** "maria@dominio.com.br" → "m•••@dominio.com.br" (PII: completo só no tooltip). */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}

/** Lista de supressão: permanente e global (LGPD) — contagens, registros e supressão manual. */
export default async function OutboundSuppressionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);

  const byReason = countBy(data.suppressions, (s) => s.reason);

  // Busca no servidor contra o e-mail COMPLETO e a origem; a exibição segue mascarada (P1 #4 do plano).
  const q = param(sp, "q");
  const qL = q.toLowerCase();
  const motivoRaw = param(sp, "motivo");
  const motivoFilter = REASONS.some((r) => r.reason === motivoRaw) ? (motivoRaw as SuppressionReason) : "";
  const hasFiltro = Boolean(q || motivoFilter);
  // Ordenação e crescimento da lista (P2 #13 do plano): ?ordem=quando inverte; ?limite= cresce.
  const ordemAsc = param(sp, "ordem") === "quando";
  const limiteRaw = Number.parseInt(param(sp, "limite"), 10);
  const limite = Number.isFinite(limiteRaw) ? Math.min(Math.max(limiteRaw, 100), 2000) : 100;
  const filtradas = [...data.suppressions]
    .filter(
      (s) =>
        (!motivoFilter || s.reason === motivoFilter) &&
        (!qL || s.email.toLowerCase().includes(qL) || (s.origin ?? "").toLowerCase().includes(qL)),
    )
    .sort((a, b) =>
      ordemAsc ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  const suppressions = filtradas.slice(0, limite);

  const buildHref = (overrides: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    if (isDemo) params.set("demo", "1");
    if (q) params.set("q", q);
    if (motivoFilter) params.set("motivo", motivoFilter);
    if (ordemAsc) params.set("ordem", "quando");
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return `/interno/outbound/supressao${qs ? `?${qs}` : ""}`;
  };

  const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const activeContacts = data.contacts
    .filter((c) => c.status === "active")
    .sort(
      (a, b) =>
        collator.compare(a.empresa ?? "", b.empresa ?? "") ||
        collator.compare(a.nome, b.nome) ||
        collator.compare(a.sobrenome ?? "", b.sobrenome ?? ""),
    );
  const selectOptions = activeContacts.slice(0, SELECT_LIMIT);

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="supressao"
      data={data}
      title="Supressão"
      subtitle="Lista permanente e global (LGPD) — um e-mail suprimido nunca mais recebe mensagem, em nenhuma campanha."
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="motivos-title">
          <h2 id="motivos-title" className="font-display text-h4 font-bold">
            Por motivo
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {REASONS.map(({ reason, explain }) => (
              <Card key={reason} padding="sm" className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">
                  {SUPPRESSION_REASON_LABELS[reason]}
                </h3>
                <p className="font-display text-h4 font-bold tabular-nums">{fmtInt(byReason.get(reason) ?? 0)}</p>
                <p className="text-xs text-foreground-subtle">{explain}</p>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="registros-title">
          <h2 id="registros-title" className="font-display text-h4 font-bold">
            Registros{" "}
            <span className="font-sans text-base font-semibold text-foreground-subtle tabular-nums">
              {fmtInt(filtradas.length)}
            </span>
          </h2>
          <form method="get" action="/interno/outbound/supressao" className="mt-3 flex flex-wrap items-end gap-3">
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <div className="flex flex-col gap-1">
              <label htmlFor="supressao-q" className={LABEL}>
                E-mail ou origem
              </label>
              <input
                id="supressao-q"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="este e-mail está suprimido?"
                className={`${CONTROL} w-64`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="supressao-motivo" className={LABEL}>
                Motivo
              </label>
              <FiltroSelect id="supressao-motivo" name="motivo" defaultValue={motivoFilter} className={CONTROL}>
                <option value="">todos</option>
                {REASONS.map(({ reason }) => (
                  <option key={reason} value={reason}>
                    {SUPPRESSION_REASON_LABELS[reason]}
                  </option>
                ))}
              </FiltroSelect>
            </div>
            <button
              type="submit"
              className="h-9 rounded-full border border-border-strong bg-transparent px-4 text-small font-semibold text-foreground transition-colors duration-(--duration-fast) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Buscar
            </button>
            {hasFiltro ? (
              <Link
                href={isDemo ? "/interno/outbound/supressao?demo=1" : "/interno/outbound/supressao"}
                className="py-1.5 text-xs text-foreground-subtle underline hover:text-brand-strong"
              >
                limpar
              </Link>
            ) : null}
          </form>
          {filtradas.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                {hasFiltro ? (
                  <>Nada corresponde à busca. Se o e-mail não aparece aqui, ele NÃO está suprimido.</>
                ) : (
                  <>
                    Nenhum e-mail suprimido até agora — descadastros, bounces e complaints entram aqui automaticamente
                    conforme acontecem.
                  </>
                )}
              </EmptyState>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Lista de supressões"
              className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface shadow-sm"
            >
              <table className="w-full min-w-[38rem] border-collapse text-small">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/60 text-left">
                    <th
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold tracking-wider text-foreground-subtle uppercase"
                    >
                      E-mail
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold tracking-wider text-foreground-subtle uppercase"
                    >
                      Motivo
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold tracking-wider text-foreground-subtle uppercase"
                    >
                      Origem
                    </th>
                    <th
                      scope="col"
                      aria-sort={ordemAsc ? "ascending" : "descending"}
                      className="px-3 py-2 text-xs font-semibold tracking-wider text-foreground-subtle uppercase"
                    >
                      <Link
                        href={buildHref({ ordem: ordemAsc ? undefined : "quando", limite: undefined })}
                        title="Ordenar por data (clique para inverter)"
                        className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
                      >
                        Quando
                        <span aria-hidden className="text-[0.6rem]">
                          {ordemAsc ? "↑" : "↓"}
                        </span>
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppressions.map((s) => (
                    <tr
                      key={`${s.email}-${s.createdAt}`}
                      className="border-b border-border last:border-b-0 even:bg-background-secondary/25"
                    >
                      <td className="px-3 py-2">
                        {/* PII: e-mail mascarado no texto; completo só no tooltip. */}
                        <span title={s.email} className="font-mono text-xs text-foreground">
                          {maskEmail(s.email)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Chip tone={REASON_TONES[s.reason]}>{SUPPRESSION_REASON_LABELS[s.reason]}</Chip>
                      </td>
                      <td className="px-3 py-2 text-foreground-muted">{s.origin?.trim() || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-foreground-muted tabular-nums">
                        <Quando iso={s.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtradas.length > suppressions.length ? (
                <div className="border-t border-border bg-background-secondary/30 px-3 py-2.5 text-center text-small">
                  <Link
                    href={buildHref({ limite: String(Math.min(limite + 100, 2000)) })}
                    className="font-semibold text-brand-strong underline-offset-2 hover:underline"
                  >
                    Mostrar mais {fmtInt(Math.min(100, filtradas.length - suppressions.length))}
                  </Link>{" "}
                  <span className="text-foreground-subtle tabular-nums">
                    · exibindo {fmtInt(suppressions.length)} de {fmtInt(filtradas.length)}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section aria-labelledby="manual-title">
          <h2 id="manual-title" className="font-display text-h4 font-bold">
            Suprimir manualmente
          </h2>
          <Card padding="sm" className="mt-4 flex flex-col gap-3">
            <p className="text-small text-foreground-muted">
              Escolha o contato na base — digitar e-mail livre é fonte de erro. Para e-mail fora da base, use a CLI{" "}
              <Code>pnpm outbound:reply --suppress</Code>.
            </p>
            {selectOptions.length === 0 ? (
              <p className="text-small text-foreground-subtle">
                Nenhum contato ativo na base — não há o que suprimir por aqui.
              </p>
            ) : (
              <form action={suppressContactAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="supressao-contato"
                    className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase"
                  >
                    Contato ativo
                  </label>
                  <select
                    id="supressao-contato"
                    name="contactId"
                    required
                    defaultValue=""
                    className="h-9 w-full rounded-md border border-border bg-surface px-3 text-small text-foreground hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none"
                  >
                    <option value="" disabled>
                      Escolha um contato…
                    </option>
                    {selectOptions.map((contact) => (
                      /* PII: e-mail só no tooltip da opção — nunca no rótulo. */
                      <option key={contact.id} value={contact.id} title={contact.email}>
                        {[contact.nome, contact.sobrenome].filter(Boolean).join(" ") || "(sem nome)"}
                        {contact.empresa ? ` · ${contact.empresa}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <ConfirmSubmit
                  confirmLabel="Confirmar supressão (permanente)"
                  className="h-9 shrink-0 rounded-full border border-error/40 px-4 text-small font-semibold text-error transition-colors duration-(--duration-fast) hover:bg-error-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Suprimir contato
                </ConfirmSubmit>
              </form>
            )}
            {activeContacts.length > SELECT_LIMIT ? (
              <p className="text-xs text-foreground-subtle">
                Listando {fmtInt(SELECT_LIMIT)} de {fmtInt(activeContacts.length)} contatos ativos (ordem por empresa) —
                para os demais, use a aba Contatos ou a CLI.
              </p>
            ) : null}
            <p className="text-xs text-foreground-subtle">
              A supressão é permanente e global: sai de todas as campanhas e nenhum envio futuro acontece. E-mails já
              agendados no Resend são cancelados quando <Code>OUTBOUND_RESEND_API_KEY</Code> está configurada — sem a
              chave, ficam marcados como “agendados órfãos” no fio de saúde até você cancelar no painel do Resend.
            </p>
          </Card>
          <p className="mt-3 text-xs text-foreground-subtle">
            Bounces e complaints entram sozinhos: <Code>pnpm outbound:sync</Code> importa os eventos do Resend e
            alimenta esta lista automaticamente.
          </p>
        </section>
      </div>
    </ConsoleShell>
  );
}
