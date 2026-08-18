import { ArrowDown, ArrowRight } from "lucide-react";
import type { FlowContent } from "@/content/types";
import { cn } from "@/lib/utils/cn";

interface FlowDiagramProps extends FlowContent {
  /** `pill`: rótulos compactos; `card`: com detalhe abaixo do rótulo. */
  variant?: "pill" | "card";
  /** Direção fixa (padrão: vertical no mobile, horizontal a partir de md). */
  direction?: "auto" | "horizontal" | "vertical";
  /** Destaca o último passo (resultado). */
  highlightLast?: boolean;
  /** Passos com fundo escuro (para seções dark, tokens já cuidam; use para variação). */
  className?: string;
  size?: "sm" | "md";
}

/**
 * Diagrama de fluxo reutilizável (PRD §61): lista ordenada com conectores.
 * Semântica: <ol> — o texto existe no HTML (SEO/a11y).
 */
export function FlowDiagram({
  title,
  steps,
  variant = "pill",
  direction = "auto",
  highlightLast = false,
  className,
  size = "md",
}: FlowDiagramProps) {
  const horizontal = direction === "horizontal";
  const vertical = direction === "vertical";
  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">{title}</figcaption>
      <ol
        className={cn(
          "flex items-stretch",
          vertical && "flex-col gap-1",
          horizontal && "flex-row flex-wrap items-center gap-2",
          direction === "auto" && "flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-2",
        )}
      >
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const emphasize = highlightLast && last;
          return (
            <li
              key={`${step.label}-${i}`}
              className={cn(
                "flex items-center",
                vertical && "flex-col items-start",
                direction === "auto" && "flex-col items-start md:flex-row md:items-center",
                horizontal && "flex-row",
              )}
            >
              <div
                className={cn(
                  "rounded-lg border shadow-sm",
                  variant === "pill" && (size === "sm" ? "px-3 py-1.5" : "px-4 py-2.5"),
                  variant === "card" && "min-w-40 px-4 py-3",
                  emphasize ? "border-brand bg-brand text-brand-ink" : "border-border bg-surface text-foreground",
                )}
              >
                <span
                  className={cn(
                    "block font-semibold",
                    size === "sm" ? "text-xs" : "text-small",
                    variant === "card" && "text-base",
                  )}
                >
                  {step.label}
                </span>
                {variant === "card" && step.detail ? (
                  <span
                    className={cn("mt-0.5 block text-xs", emphasize ? "text-brand-ink/80" : "text-foreground-muted")}
                  >
                    {step.detail}
                  </span>
                ) : null}
              </div>
              {!last ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex items-center text-foreground-subtle",
                    vertical && "h-7 w-full justify-start pl-5",
                    horizontal && "justify-center px-1",
                    direction === "auto" &&
                      "h-7 w-full justify-start pl-5 md:h-auto md:w-auto md:justify-center md:px-1",
                  )}
                >
                  {vertical ? (
                    <ArrowDown className="size-4" />
                  ) : horizontal ? (
                    <ArrowRight className="size-4" />
                  ) : (
                    <>
                      <ArrowDown className="size-4 md:hidden" />
                      <ArrowRight className="hidden size-4 md:block" />
                    </>
                  )}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
