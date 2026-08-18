import type { FlowContent } from "@/content/types";
import { cn } from "@/lib/utils/cn";

type Size = "sm" | "md" | "lg";

interface FlowDiagramProps extends FlowContent {
  /** `pill`: só o rótulo; `card`: rótulo + detalhe abaixo (quando existir). */
  variant?: "pill" | "card";
  /**
   * `vertical`: trilho ("rail") com marcadores alinhados — usado em cards e painéis.
   * `horizontal`: pílulas ligadas por um fio.
   * `auto` (padrão): trilho de pílulas no mobile, pílulas ligadas em linha a partir de md.
   */
  direction?: "auto" | "horizontal" | "vertical";
  /** Destaca o último passo (o resultado). */
  highlightLast?: boolean;
  /** Marcadores numerados (só quando a ordem carrega informação — ex.: diagnóstico). */
  numbered?: boolean;
  className?: string;
  size?: Size;
}

/**
 * Diagrama de fluxo reutilizável (PRD §61). Semântica: <ol> — o texto existe no HTML (SEO/a11y).
 * Vertical = "rail": marcadores centrados numa linha contínua, rótulos alinhados à esquerda e o
 * último passo em pílula verde. Horizontal = pílulas ligadas por um fio fino.
 */
export function FlowDiagram({
  title,
  steps,
  variant = "pill",
  direction = "auto",
  highlightLast = false,
  numbered = false,
  className,
  size = "md",
}: FlowDiagramProps) {
  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">{title}</figcaption>
      {direction === "vertical" ? (
        <Rail steps={steps} variant={variant} highlightLast={highlightLast} numbered={numbered} size={size} />
      ) : (
        <Track steps={steps} highlightLast={highlightLast} responsive={direction === "auto"} size={size} />
      )}
    </figure>
  );
}

/* ------------------------------- vertical -------------------------------- */

const rail = {
  sm: {
    row: "gap-y-2.5",
    col: "gap-x-3",
    dot: "size-2.5 mt-[0.36em]",
    num: "size-6 text-[0.6875rem]",
    label: "text-xs leading-[1.5]",
    detail: "text-[0.6875rem]",
    pill: "-my-0.5 -ml-2 rounded-full py-0.5 pr-2.5 pl-2",
    lineTail: "-mb-2.5",
    numRow: "min-h-6",
  },
  md: {
    row: "gap-y-3",
    col: "gap-x-3.5",
    dot: "size-3 mt-[0.37em]",
    num: "size-7 text-xs",
    label: "text-small leading-[1.55]",
    detail: "text-xs",
    pill: "-my-1 -ml-2.5 rounded-full py-1 pr-3 pl-2.5",
    lineTail: "-mb-3",
    numRow: "min-h-7",
  },
  lg: {
    row: "gap-y-4",
    col: "gap-x-4",
    dot: "size-3.5 mt-[0.3em]",
    num: "size-9 text-xs",
    label: "font-display text-h4 font-bold leading-[1.3]",
    detail: "text-small",
    pill: "-my-1 -ml-3 rounded-full py-1 pr-3.5 pl-3",
    lineTail: "-mb-4",
    numRow: "min-h-9",
  },
} as const;

function Rail({
  steps,
  variant,
  highlightLast,
  numbered,
  size,
}: {
  steps: FlowContent["steps"];
  variant: "pill" | "card";
  highlightLast: boolean;
  numbered: boolean;
  size: Size;
}) {
  const s = rail[size];
  return (
    <ol className={cn("flex flex-col", s.row)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const emphasize = highlightLast && last;
        return (
          <li key={`${step.label}-${i}`} className={cn("flex", s.col)}>
            {/* coluna do marcador: marcador + linha até o próximo marcador */}
            <span aria-hidden="true" className="flex shrink-0 flex-col items-center self-stretch">
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-full border font-semibold tabular-nums",
                  numbered ? s.num : s.dot,
                  emphasize
                    ? "border-brand bg-brand text-brand-ink shadow-glow-soft"
                    : numbered
                      ? "border-border bg-surface text-foreground-muted"
                      : "border-border-strong bg-surface",
                )}
              >
                {numbered ? String(i + 1).padStart(2, "0") : null}
              </span>
              {!last ? <span className={cn("mt-1 w-px flex-1 bg-border-strong", s.lineTail)} /> : null}
            </span>
            <span className={cn("flex min-w-0 flex-col", numbered && cn("justify-center", s.numRow))}>
              <span
                className={cn(
                  "font-semibold",
                  s.label,
                  emphasize ? cn("inline-block w-fit bg-brand text-brand-ink", s.pill) : "text-foreground",
                )}
              >
                {step.label}
              </span>
              {variant === "card" && step.detail ? (
                <span className={cn("mt-0.5 text-foreground-muted", s.detail)}>{step.detail}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------ horizontal ------------------------------- */

function Track({
  steps,
  highlightLast,
  responsive,
  size,
}: {
  steps: FlowContent["steps"];
  highlightLast: boolean;
  responsive: boolean;
  size: Size;
}) {
  const pill = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-small";
  return (
    <ol
      className={cn(
        "flex",
        responsive
          ? "flex-col items-start md:flex-row md:flex-wrap md:items-center md:gap-y-3"
          : "flex-row flex-wrap items-center gap-y-3",
      )}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const emphasize = highlightLast && last;
        return (
          <li
            key={`${step.label}-${i}`}
            className={cn(
              "flex",
              responsive ? "flex-col items-start md:flex-row md:items-center" : "flex-row items-center",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center rounded-full border font-semibold whitespace-nowrap shadow-sm",
                pill,
                emphasize ? "border-brand bg-brand text-brand-ink" : "border-border bg-surface text-foreground",
              )}
            >
              {step.label}
            </span>
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  "flex items-center",
                  responsive ? "ml-5 h-6 flex-col md:mx-1.5 md:h-auto md:flex-row" : "mx-1.5",
                )}
              >
                <span className={cn("bg-border-strong", responsive ? "h-full w-px md:h-px md:w-5" : "h-px w-5")} />
                <span className="size-1 rounded-full bg-border-strong" />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
