import type { ReactNode } from "react";
import Link from "next/link";
import { getOutboundEnv } from "@/lib/outbound/config";
import { dailyCap, usedTodayCount } from "@/lib/outbound/engine";
import { evaluateGuardRails } from "@/lib/outbound/guardrails";
import { orphanScheduled } from "@/lib/outbound/metrics";
import { consoleHref, type DashboardData } from "./data";
import { Code, fmtDateTime, fmtInt, fmtPct } from "./ui";

/**
 * Casca do console: cabeçalho, FIO DE SAÚDE (assinatura visual — estado operacional
 * sempre à vista) e navegação. Toda página do console renderiza dentro dela.
 * Contrato estável — as páginas passam `data` e a aba ativa.
 */

export type ConsoleTab = "visao-geral" | "campanha" | "contatos" | "respostas" | "atividade" | "supressao";

const TABS: Array<{ id: ConsoleTab; label: string; href: string }> = [
  { id: "visao-geral", label: "Visão geral", href: "/interno/outbound" },
  { id: "contatos", label: "Contatos", href: "/interno/outbound/contatos" },
  { id: "respostas", label: "Respostas", href: "/interno/outbound/respostas" },
  { id: "atividade", label: "Atividade", href: "/interno/outbound/atividade" },
  { id: "supressao", label: "Supressão", href: "/interno/outbound/supressao" },
];

export interface ConsoleShellProps {
  active: ConsoleTab;
  data: DashboardData;
  title: string;
  subtitle?: string;
  /** Ações contextuais da página (botões/links), exibidas no cabeçalho. */
  headerExtra?: ReactNode;
  children: ReactNode;
}

// ─── Fio de saúde ────────────────────────────────────────────────────────────

type PillTone = "ok" | "neutral" | "warn" | "crit";

const PILL_TONES: Record<PillTone, string> = {
  ok: "bg-brand-soft text-success",
  neutral: "bg-background-secondary text-foreground-muted",
  warn: "border border-warning/50 text-warning",
  crit: "bg-error-soft text-error",
};

/** Pílula do fio de saúde: ponto de estado + rótulo curto; detalhe fica no title. */
function HealthPill({ tone, title, children }: { tone: PillTone; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-semibold whitespace-nowrap tabular-nums ${PILL_TONES[tone]}`}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function ConsoleShell({ active, data, title, subtitle, headerExtra, children }: ConsoleShellProps) {
  const now = new Date();
  const env = getOutboundEnv();
  const rails = evaluateGuardRails(data.sends);
  const cap = dailyCap(data.state, env, now);
  const usados = usedTodayCount(data.sends, now, env.utcOffset);
  const pendings = data.sends.filter((s) => s.status === "pending").length;
  const orphans = orphanScheduled(data.sends, data.contacts, data.enrollments).length;
  const breakerAt = data.state.breakerTrippedAt;

  // Faixas do PRD §21 (mesmas do BounceChip): verde < 2% · âmbar 2–3% · vermelho ≥ 3%.
  const bounceTone: PillTone =
    rails.sent === 0 ? "neutral" : rails.bounceRate < 0.02 ? "ok" : rails.bounceRate < 0.03 ? "warn" : "crit";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {data.isDemo ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-warning/60 bg-warning/10 px-4 py-2.5 text-small text-foreground">
          <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold tracking-wide text-background uppercase">
            Demo
          </span>
          <span>
            Dados simulados por <Code>pnpm outbound:demo</Code> — nenhum número aqui é real.
          </span>
          <Link
            href="/interno/outbound"
            className="font-semibold text-foreground underline underline-offset-2 hover:text-brand-strong"
          >
            Sair do modo demo
          </Link>
        </div>
      ) : null}

      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dreamy Outbound</p>
          <h1 className="mt-1.5 font-display text-h3 font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-small text-foreground-muted">{subtitle}</p> : null}
        </div>
        {headerExtra ? <div className="flex flex-wrap items-center gap-2">{headerExtra}</div> : null}
      </header>

      {/* Fio de saúde: estado operacional sempre visível (assinatura do console). */}
      <div role="group" aria-label="Saúde da operação" className="mb-5 flex flex-wrap items-center gap-1.5">
        <HealthPill
          tone={data.state.armed ? "ok" : "neutral"}
          title={
            data.state.armed
              ? `Automação armada${data.state.armedAt ? ` em ${fmtDateTime(data.state.armedAt)}` : ""} — desarmar pelo console é sempre seguro.`
              : "Envio real exige armar pela CLI: pnpm outbound:arm arm --confirm (PRD §20)."
          }
        >
          {data.state.armed ? "automação armada" : "automação desarmada"}
        </HealthPill>

        <HealthPill
          tone={breakerAt ? "crit" : "neutral"}
          title={
            breakerAt
              ? `${data.state.breakerReason ?? "sem motivo registrado"} · desde ${fmtDateTime(breakerAt)} · religar: pnpm outbound:arm reset-breaker --confirm`
              : "Pausa automática por complaint ou bounce fora da faixa (PRD §21)."
          }
        >
          {breakerAt ? "breaker disparado" : "breaker ok"}
        </HealthPill>

        <HealthPill
          tone={cap > 0 && usados >= cap ? "warn" : "neutral"}
          title="Envios agendados/feitos hoje sobre o cap do dia (rampa do PRD §17)."
        >
          envios hoje {fmtInt(usados)}/{fmtInt(cap)}
        </HealthPill>

        <HealthPill
          tone={bounceTone}
          title="Taxa de bounce global — verde < 2% · âmbar 2–3% · vermelho ≥ 3% (PRD §21)."
        >
          bounce {rails.sent > 0 ? `${fmtPct(rails.bounceRate)} · ${fmtInt(rails.bounced)}/${fmtInt(rails.sent)}` : "—"}
        </HealthPill>

        {rails.complained > 0 ? (
          <HealthPill tone="crit" title="Qualquer complaint dispara o breaker global (PRD §21).">
            complaints {fmtInt(rails.complained)}
          </HealthPill>
        ) : null}

        {pendings > 0 ? (
          <HealthPill
            tone="crit"
            title="Run interrompido — resolva com pnpm outbound:send --resolve-pending antes de qualquer envio."
          >
            {fmtInt(pendings)} pending
          </HealthPill>
        ) : null}

        {orphans > 0 ? (
          <HealthPill
            tone="crit"
            title="E-mails agendados no Resend para contato suprimido ou sequência parada — o cancelamento falhou ou OUTBOUND_RESEND_API_KEY estava ausente. Cancele no painel do Resend (busque pelo destinatário) ou defina a chave e repita a supressão."
          >
            {fmtInt(orphans)} agendado(s) órfão(s)
          </HealthPill>
        ) : null}
      </div>

      <nav aria-label="Seções do console" className="mb-8 flex flex-wrap gap-1 border-b border-border text-small">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={consoleHref(tab.href, data.isDemo)}
            aria-current={tab.id === active ? "page" : undefined}
            className={
              tab.id === active
                ? "-mb-px border-b-2 border-brand-strong px-3 py-2 font-semibold text-brand-strong"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-foreground-muted hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
