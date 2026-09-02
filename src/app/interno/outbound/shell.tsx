import type { ReactNode } from "react";
import Link from "next/link";
import { getOutboundEnv } from "@/lib/outbound/config";
import { dailyCap, usedTodayCount } from "@/lib/outbound/engine";
import { evaluateGuardRails } from "@/lib/outbound/guardrails";
import { orphanScheduled } from "@/lib/outbound/metrics";
import { Aquario } from "./aquario";
import { AquarioChat } from "./aquario-chat";
import { AtalhosDoConsole } from "./atalhos";
import { MaterialRoot } from "./material-root";
import { consoleHref, type DashboardData } from "./data";
import { Code, fmtDateTime, fmtInt, fmtPct, plural } from "./ui";

/**
 * Casca do console: cabeçalho, FIO DE SAÚDE (assinatura visual — estado operacional
 * sempre à vista) e navegação. Toda página do console renderiza dentro dela.
 * Contrato estável — as páginas passam `data` e a aba ativa.
 */

export type ConsoleTab =
  | "visao-geral"
  | "hoje"
  | "agenda"
  | "pipeline"
  | "campanha"
  | "contatos"
  | "respostas"
  | "atividade"
  | "demandas"
  | "mork"
  | "supressao"
  | "configuracao";

const TABS: Array<{ id: ConsoleTab; label: string; href: string }> = [
  { id: "visao-geral", label: "Visão geral", href: "/interno/outbound" },
  { id: "hoje", label: "Hoje", href: "/interno/outbound/hoje" },
  { id: "agenda", label: "Agenda", href: "/interno/outbound/agenda" },
  { id: "pipeline", label: "Pipeline", href: "/interno/outbound/pipeline" },
  { id: "contatos", label: "Contatos", href: "/interno/outbound/contatos" },
  { id: "respostas", label: "Respostas", href: "/interno/outbound/respostas" },
  { id: "atividade", label: "Atividade", href: "/interno/outbound/atividade" },
  { id: "demandas", label: "Demandas", href: "/interno/outbound/demandas" },
  { id: "mork", label: "MORK", href: "/interno/outbound/mork" },
  { id: "supressao", label: "Supressão", href: "/interno/outbound/supressao" },
  { id: "configuracao", label: "Configuração", href: "/interno/outbound/configuracao" },
];

export interface ConsoleShellProps {
  active: ConsoleTab;
  data: DashboardData;
  title: string;
  subtitle?: string;
  /** Ações contextuais da página (botões/links), exibidas no cabeçalho. */
  headerExtra?: ReactNode;
  /** E-mail da sessão autenticada (retorno de `requireSession`); exibe o chip e o botão "Sair". */
  sessionEmail?: string;
  children: ReactNode;
}

// ─── Fio de saúde ────────────────────────────────────────────────────────────

type PillTone = "ok" | "neutral" | "warn" | "crit";

const PILL_TONES: Record<PillTone, string> = {
  ok: "bg-brand-soft text-success",
  neutral: "bg-background-secondary text-foreground-muted",
  warn: "bg-warning-soft text-warning",
  // pulse-crit: pulso sutil (globals.css, escopo do console) — alerta vivo, como no Aquário.
  crit: "bg-error-soft text-error pulse-crit",
};

/**
 * Pílula do fio de saúde: ponto de estado + rótulo curto; detalhe fica no
 * title. Com `href`, a pílula vira link para a aba onde se age (achado da
 * auditoria de usabilidade: a ação não pode morar só no tooltip).
 */
function HealthPill({
  tone,
  title,
  href,
  children,
}: {
  tone: PillTone;
  title?: string;
  href?: string;
  children: ReactNode;
}) {
  const className = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-semibold whitespace-nowrap tabular-nums ${PILL_TONES[tone]} ${
    href ? "underline-offset-2 transition-shadow duration-(--duration-fast) hover:underline hover:shadow-sm" : ""
  }`;
  const dot = <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />;
  if (href) {
    return (
      <Link href={href} title={title} className={className}>
        {dot}
        {children}
      </Link>
    );
  }
  return (
    <span title={title} className={className}>
      {dot}
      {children}
    </span>
  );
}

export function ConsoleShell({
  active,
  data,
  title,
  subtitle,
  headerExtra,
  sessionEmail,
  children,
}: ConsoleShellProps) {
  const now = new Date();
  const env = getOutboundEnv();
  const rails = evaluateGuardRails(data.sends);
  const cap = dailyCap(data.state, env, now);
  const usados = usedTodayCount(data.sends, now, env.utcOffset);
  const pendings = data.sends.filter((s) => s.status === "pending").length;
  const orphans = orphanScheduled(data.sends, data.contacts, data.enrollments).length;
  const demandasPendentes = data.demands.filter((d) => d.status === "pendente").length;
  const breakerAt = data.state.breakerTrippedAt;
  // A página de campanha vive sob a Visão geral (não tem aba própria).
  const activeTab: ConsoleTab = active === "campanha" ? "visao-geral" : active;

  // Faixas do PRD §21 (mesmas do BounceChip): verde < 2% · âmbar 2–3% · vermelho ≥ 3%.
  const bounceTone: PillTone =
    rails.sent === 0 ? "neutral" : rails.bounceRate < 0.02 ? "ok" : rails.bounceRate < 0.03 ? "warn" : "crit";

  return (
    <div data-app="console" className="mx-auto flex max-w-[105rem] justify-center gap-10 px-4 py-6 sm:px-6 sm:py-8">
      {/* Atalhos: "/" foca a busca; Alt+1..9 troca de aba (P1 #9 do plano). */}
      <AtalhosDoConsole hrefs={TABS.slice(0, 9).map((tab) => consoleHref(tab.href, data.isDemo))} />
      {/* Toasts (portal fora deste wrapper) herdam o vidro do console (P2 #10). */}
      <MaterialRoot />
      {/* Luz ambiente do app (decorativa): dá matéria para o vidro fosco desfocar. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50rem 30rem at 12% -6%, rgb(70 235 126 / 0.08), transparent 60%), radial-gradient(44rem 26rem at 88% 10%, rgb(70 235 126 / 0.05), transparent 65%), radial-gradient(46rem 32rem at 50% 112%, rgb(11 11 12 / 0.05), transparent 70%)",
        }}
      />
      <div className="w-full max-w-6xl min-w-0">
        {sessionEmail ? (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-xs">
            <span
              title="Sessão autenticada do console"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-medium text-foreground-muted"
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current text-success" />
              <span className="truncate">{sessionEmail}</span>
            </span>
            <form action="/interno/logout" method="post">
              <button
                type="submit"
                className="rounded-full px-2.5 py-1 font-semibold text-foreground-muted underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Sair
              </button>
            </form>
          </div>
        ) : null}

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
            <p className="eyebrow">{data.settings.empresaNome} · plataforma de vendas</p>
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
            title="Envios agendados/feitos hoje sobre o cap do dia (rampa do PRD §17). Ver a Agenda."
            href={consoleHref("/interno/outbound/agenda", data.isDemo)}
          >
            envios hoje {fmtInt(usados)}/{fmtInt(cap)}
          </HealthPill>

          <HealthPill
            tone={bounceTone}
            title="Taxa de bounce global — verde < 2% · âmbar 2–3% · vermelho ≥ 3% (PRD §21). Ver a Atividade."
            href={consoleHref("/interno/outbound/atividade", data.isDemo)}
          >
            bounce{" "}
            {rails.sent > 0 ? `${fmtPct(rails.bounceRate)} · ${fmtInt(rails.bounced)}/${fmtInt(rails.sent)}` : "—"}
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
              {plural(orphans, "agendado órfão", "agendados órfãos")}
            </HealthPill>
          ) : null}

          {demandasPendentes > 0 ? (
            <HealthPill
              tone="warn"
              title="Demandas do time aguardando o MORK assumir. Ver as Demandas."
              href={consoleHref("/interno/outbound/demandas", data.isDemo)}
            >
              {plural(demandasPendentes, "demanda pendente", "demandas pendentes")}
            </HealthPill>
          ) : null}
        </div>

        {/* Navegação em barra segmentada de vidro (o item ativo é a "pílula" sólida). */}
        <nav
          aria-label="Seções do console"
          className="mb-8 flex flex-wrap gap-1 rounded-2xl border border-border bg-surface p-1.5 text-small shadow-sm"
        >
          {TABS.map((tab, idx) => (
            <Link
              key={tab.id}
              href={consoleHref(tab.href, data.isDemo)}
              title={idx < 9 ? `Alt+${idx + 1}` : undefined}
              aria-current={tab.id === activeTab ? "page" : undefined}
              className={
                tab.id === activeTab
                  ? "rounded-full bg-white px-3.5 py-1.5 font-semibold text-brand-strong shadow-sm"
                  : "rounded-full px-3.5 py-1.5 text-foreground-muted transition-colors duration-(--duration-fast) hover:bg-white/55 hover:text-foreground"
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* T5 do redesign: entrada viva — os blocos de toda aba sobem com mola
            e stagger sutil (CSS no bloco do console em globals; reduced-motion = nada). */}
        <div className="entra-viva">{children}</div>
      </div>

      {/* A SALA DO MORK (pedido do Luigi): área lateral DEDICADA, separada do CRM
          por uma parede de vidro própria. Em cima, a rede neural do time; abaixo
          da linha, a área de chat em altura cheia. */}
      <aside aria-label="Sala do MORK" className="hidden w-[21rem] shrink-0 2xl:block">
        <div className="sticky top-0 flex h-dvh flex-col border-l border-border bg-white/35 py-5 pr-2 pl-6 backdrop-blur-md">
          <div className="min-h-[17rem] shrink-0 basis-[42%]">
            <Aquario data={data} variante="sala" />
          </div>
          <div className="mt-4 mb-3 shrink-0 border-t border-border" />
          <div className="min-h-0 flex-1">
            <AquarioChat isDemo={data.isDemo} variante="sala" />
          </div>
        </div>
      </aside>
    </div>
  );
}
