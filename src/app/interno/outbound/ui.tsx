import type { ReactNode } from "react";
import type { DailySendPoint } from "@/lib/outbound/metrics";
import { cn } from "@/lib/utils/cn";
import type {
  AgentActivityKind,
  CampaignDefinition,
  CampaignRuntime,
  Contact,
  ContactStatus,
  DealStage,
  DemandKind,
  DemandStatus,
  OutboundEventType,
  ReplyClass,
  SendRecord,
  SolutionAnchor,
  StopReason,
  SuppressionReason,
  VerificationStatus,
} from "@/lib/outbound/types";

/**
 * Componentes de apresentação do dashboard interno de outbound (PRD-EMAIL-OUTBOUND §16).
 * 100% Server Components — o dashboard V1 é somente leitura; ações ficam na CLI (§20).
 * Regra de PII: e-mail de contato nunca aparece como texto visível — no máximo em
 * `title` (tooltip), que é o uso interno correto.
 */

// ─── Formatação pt-BR ────────────────────────────────────────────────────────

const intFmt = new Intl.NumberFormat("pt-BR");
const pctFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function fmtInt(n: number): string {
  return intFmt.format(n);
}

export function fmtPct(rate: number): string {
  return pctFmt.format(rate);
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function fmtBRL(value: number): string {
  return brlFmt.format(value);
}

export function fmtDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function fmtDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** Agrupa e conta por chave (ignora chaves ausentes). */
export function countBy<T>(rows: T[], key: (row: T) => string | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** Send que saiu de fato (delivered/bounced/complained implicam envio). */
export function wasSent(send: SendRecord): boolean {
  return (
    send.status === "sent" || send.status === "delivered" || send.status === "bounced" || send.status === "complained"
  );
}

// ─── Rótulos pt-BR dos enums do domínio ──────────────────────────────────────

export const ANCHOR_LABELS: Record<SolutionAnchor, string> = {
  "nova-receita": "Nova Receita Digital",
  sistema: "Sistemas Sob Medida",
  "agente-ia": "Agentes de IA",
};

export const EVENT_TYPE_LABELS: Record<OutboundEventType, string> = {
  sent: "enviado",
  delivered: "entregue",
  delivery_delayed: "entrega atrasada",
  bounced: "bounce",
  complained: "complaint",
  opened: "abertura*",
  clicked: "clique",
  failed: "falha",
  canceled: "cancelado",
  suppressed: "suprimido",
};

export const REPLY_CLASS_LABELS: Record<ReplyClass, string> = {
  interested: "interessado",
  not_now: "agora não",
  referral: "indicação",
  negative: "negativa",
  ooo: "fora do escritório",
  other: "outra",
};

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  reply: "resposta",
  unsubscribe: "descadastro",
  bounce: "bounce",
  complaint: "complaint",
  manual: "manual",
  breaker: "circuit breaker",
};

export const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
  unsubscribe: "descadastro",
  hard_bounce: "hard bounce",
  complaint: "complaint",
  manual: "manual",
  client: "cliente",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  active: "ativos",
  excluded: "excluídos",
  suppressed: "suprimidos",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  ok: "ok",
  risky: "arriscados",
  invalid: "inválidos",
  unverified: "não verificados",
};

// ─── Chips ───────────────────────────────────────────────────────────────────

export type ChipTone = "neutral" | "brand" | "success" | "warning" | "error" | "outline";

const chipTones: Record<ChipTone, string> = {
  neutral: "bg-background-secondary text-foreground-muted",
  brand: "bg-brand-soft text-brand-strong",
  success: "bg-brand-soft text-success",
  warning: "border border-warning/50 text-warning",
  error: "bg-error-soft text-error",
  outline: "border border-border text-foreground-muted",
};

export function Chip({
  tone = "neutral",
  title,
  className,
  children,
}: {
  tone?: ChipTone;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-none font-semibold whitespace-nowrap",
        chipTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const EVENT_TYPE_TONES: Record<OutboundEventType, ChipTone> = {
  sent: "outline",
  delivered: "success",
  delivery_delayed: "warning",
  bounced: "error",
  complained: "error",
  opened: "neutral",
  clicked: "brand",
  failed: "error",
  canceled: "neutral",
  suppressed: "warning",
};

export const REPLY_CLASS_TONES: Record<ReplyClass, ChipTone> = {
  interested: "success",
  not_now: "neutral",
  referral: "brand",
  negative: "error",
  ooo: "outline",
  other: "neutral",
};

// ─── Pipeline de negócios (CRM piloto, PRD §29) ──────────────────────────────

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  novo: "novo",
  contatado: "contatado",
  respondeu: "respondeu",
  reuniao_marcada: "reunião marcada",
  reuniao_realizada: "reunião realizada",
  proposta: "proposta",
  ganho: "ganho",
  perdido: "perdido",
};

export const DEAL_STAGE_TONES: Record<DealStage, ChipTone> = {
  novo: "outline",
  contatado: "neutral",
  respondeu: "brand",
  reuniao_marcada: "success",
  reuniao_realizada: "success",
  proposta: "brand",
  ganho: "success",
  perdido: "error",
};

// ─── Demandas e prestação de contas do MORK (PRD §29) ────────────────────────

export const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  pendente: "pendente",
  em_andamento: "em andamento",
  concluida: "concluída",
  recusada: "recusada",
  cancelada: "cancelada",
};

export const DEMAND_STATUS_TONES: Record<DemandStatus, ChipTone> = {
  pendente: "warning",
  em_andamento: "brand",
  concluida: "success",
  recusada: "neutral",
  cancelada: "neutral",
};

export const DEMAND_KIND_LABELS: Record<DemandKind, string> = {
  copy: "copy",
  leads: "leads",
  analise: "análise",
  resposta: "respostas",
  operacao: "operação",
  outra: "outra",
};

export const AGENT_ACTIVITY_LABELS: Record<AgentActivityKind, string> = {
  demanda: "demanda",
  briefing: "briefing",
  sugestao: "sugestão",
  crm: "CRM",
  observacao: "observação",
};

// ─── Status de campanha (definição versionada + runtime do store) ────────────

export type CampaignDisplayStatus = "draft" | "ready" | "aprovada" | "pausada";

export function campaignDisplayStatus(def: CampaignDefinition, runtime?: CampaignRuntime): CampaignDisplayStatus {
  if (runtime?.pausedAt) return "pausada";
  if (runtime?.approvedAt) return "aprovada";
  return def.status;
}

const campaignStatusChips: Record<CampaignDisplayStatus, { label: string; tone: ChipTone }> = {
  draft: { label: "draft", tone: "neutral" },
  ready: { label: "ready", tone: "outline" },
  aprovada: { label: "aprovada", tone: "success" },
  pausada: { label: "pausada", tone: "warning" },
};

export function CampaignStatusChip({ status }: { status: CampaignDisplayStatus }) {
  const { label, tone } = campaignStatusChips[status];
  return <Chip tone={tone}>{label}</Chip>;
}

/** Chip de bounce nas faixas do PRD §21: verde < 2% · âmbar 2–3% · vermelho > 3%. */
export function BounceChip({ rate, sample }: { rate: number; sample: number }) {
  if (sample === 0) return <Chip tone="neutral">—</Chip>;
  const tone: ChipTone = rate < 0.02 ? "success" : rate < 0.03 ? "warning" : "error";
  return <Chip tone={tone}>{fmtPct(rate)}</Chip>;
}

// ─── Blocos de apresentação ──────────────────────────────────────────────────

/** Métrica compacta (par dt/dd — usar dentro de um <dl>). */
export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-foreground-subtle">{label}</dt>
      <dd className="mt-0.5 text-small font-semibold text-foreground tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-foreground-subtle">{hint}</dd> : null}
    </div>
  );
}

/**
 * Contato em tabelas: nome + empresa (uso interno correto).
 * O e-mail (PII) só aparece em `title` — nunca como texto visível.
 */
export function ContactCell({ contact }: { contact: Pick<Contact, "nome" | "sobrenome" | "empresa" | "email"> }) {
  const name = [contact.nome, contact.sobrenome].filter(Boolean).join(" ") || "(sem nome)";
  return (
    <span title={contact.email}>
      <span className="font-medium text-foreground">{name}</span>
      {contact.empresa ? <span className="text-foreground-subtle"> · {contact.empresa}</span> : null}
    </span>
  );
}

/** Estado vazio honesto — nunca renderizar dados inventados. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-background-secondary/40 px-5 py-8 text-center text-small text-foreground-muted">
      {children}
    </div>
  );
}

/** Trecho de comando/código inline. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-xs bg-background-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

/** Ressalva fixa de abertura (PRD §21) — acompanha toda métrica de "abertos". */
export function OpenRateNote() {
  return (
    <p className="text-xs text-foreground-subtle">
      * Abertura inflada por proxies Apple/Gmail — decida por respostas e cliques.
    </p>
  );
}

// ─── Métrica-norte e sparkline (visão geral) ─────────────────────────────────

/** Métrica de destaque: grande mas sóbria (Urbanist, tabular-nums). Usar em <dl>. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-display text-4xl leading-none font-bold tabular-nums",
          tone === "success" ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="mt-1.5 text-xs text-foreground-subtle">{hint}</dd> : null}
    </div>
  );
}

/** "27/08" a partir da chave YYYY-MM-DD (sem passar por Date — evita shift de fuso). */
function dayLabel(dateKey: string): string {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

const SPARK = { barW: 4, gap: 2, h: 36 } as const;

/**
 * Envios por dia em SVG puro (CSP sem libs): barras finas neutras; bounce por
 * cima em vermelho (cor semântica só em estado). Números ficam no title de cada
 * barra e no resumo acessível/rodapé.
 */
export function DailySendSparkline({ points }: { points: DailySendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.sent));
  const width = points.length * (SPARK.barW + SPARK.gap) - SPARK.gap;
  const usable = SPARK.h - 3;
  const totalSent = points.reduce((n, p) => n + p.sent, 0);
  const totalBounced = points.reduce((n, p) => n + p.bounced, 0);
  const first = points.at(0);
  const last = points.at(-1);
  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${SPARK.h}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`Envios por dia (${points.length} dias): ${fmtInt(totalSent)} envios, ${fmtInt(totalBounced)} bounces.`}
      >
        {points.map((p, i) => {
          const x = i * (SPARK.barW + SPARK.gap);
          const hSent = p.sent > 0 ? Math.max((p.sent / max) * usable, 1.5) : 0;
          const hBounce = p.bounced > 0 ? Math.max((p.bounced / max) * usable, 1.5) : 0;
          return (
            <g key={p.date}>
              <title>
                {`${dayLabel(p.date)}: ${fmtInt(p.sent)} ${p.sent === 1 ? "envio" : "envios"}${
                  p.bounced > 0 ? ` · ${fmtInt(p.bounced)} bounce` : ""
                }`}
              </title>
              {hSent > 0 ? (
                <rect x={x} y={SPARK.h - 1 - hSent} width={SPARK.barW} height={hSent} fill="var(--foreground-subtle)" />
              ) : null}
              {hBounce > 0 ? (
                <rect x={x} y={SPARK.h - 1 - hBounce} width={SPARK.barW} height={hBounce} fill="var(--error)" />
              ) : null}
            </g>
          );
        })}
        <rect x="0" y={SPARK.h - 1} width={width} height="1" fill="var(--border-strong)" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-foreground-subtle">
        <span className="tabular-nums">{first && last ? `${dayLabel(first.date)} – ${dayLabel(last.date)}` : "—"}</span>
        <span className="tabular-nums">
          {fmtInt(totalSent)} {totalSent === 1 ? "envio" : "envios"} no período
          {totalBounced > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-error">{fmtInt(totalBounced)} bounce</span>
            </>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

// ─── Funil por passo (barras horizontais em SVG puro — CSP sem libs) ─────────

export interface FunnelStepData {
  stepId: string;
  subject: string;
  planejados: number;
  enviados: number;
  entregues: number;
  abertos: number;
  cliques: number;
  respostas: number;
}

const FUNNEL_METRICS = [
  { key: "planejados", label: "Planejados", color: "var(--border-strong)" },
  { key: "enviados", label: "Enviados", color: "var(--foreground-subtle)" },
  { key: "entregues", label: "Entregues", color: "var(--brand-primary)" },
  { key: "abertos", label: "Abertos*", color: "var(--brand-soft-strong)" },
  { key: "cliques", label: "Cliques", color: "var(--brand-strong)" },
  { key: "respostas", label: "Respostas", color: "var(--foreground)" },
] as const;

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  // Barra proporcional ao maior valor do funil; valor > 0 sempre ganha um traço visível.
  const pct = max > 0 && value > 0 ? Math.max((value / max) * 100, 1) : 0;
  return (
    <div className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3">
      <span className="text-xs text-foreground-muted">{label}</span>
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 w-full" aria-hidden="true" focusable="false">
        <rect x="0" y="0" width="100" height="8" fill="var(--background-secondary)" />
        {pct > 0 ? <rect x="0" y="0" width={pct} height="8" fill={color} /> : null}
      </svg>
      <span className="text-right text-xs font-semibold text-foreground tabular-nums">{fmtInt(value)}</span>
    </div>
  );
}

/** Funil de valor (8 degraus, visão geral): barras horizontais em SVG puro. */
export function ValueFunnel({ stages }: { stages: Array<{ key: string; label: string; value: number }> }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="flex flex-col gap-1.5">
      {stages.map((stage, i) => (
        <div key={stage.key} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3">
          <span className="text-xs text-foreground-muted">{stage.label}</span>
          <svg
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            className="h-2.5 w-full"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="0" y="0" width="100" height="8" fill="var(--background-secondary)" />
            {stage.value > 0 ? (
              <rect
                x="0"
                y="0"
                width={Math.max((stage.value / max) * 100, 1)}
                height="8"
                fill={i >= stages.length - 2 ? "var(--brand-strong)" : "var(--brand-primary)"}
              />
            ) : null}
          </svg>
          <span className="text-right text-xs font-semibold text-foreground tabular-nums">{fmtInt(stage.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Funil E1..E4 — os valores numéricos ao lado das barras são o conteúdo acessível. */
export function StepFunnel({ steps }: { steps: FunnelStepData[] }) {
  const max = Math.max(1, ...steps.flatMap((s) => FUNNEL_METRICS.map((m) => s[m.key])));
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {steps.map((step) => (
        <div key={step.stepId} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-baseline gap-3">
            <h3 className="font-display text-small font-bold uppercase">{step.stepId}</h3>
            <p className="min-w-0 truncate text-xs text-foreground-subtle" title={step.subject}>
              {step.subject}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {FUNNEL_METRICS.map((m) => (
              <BarRow key={m.key} label={m.label} value={step[m.key]} max={max} color={m.color} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
