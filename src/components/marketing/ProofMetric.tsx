import type { ProofMetric as ProofMetricModel } from "@/content/proof";

/** Indicador comprovável (PRD §17–§18). Só renderiza métricas verificadas. */
export function ProofMetric({ metric }: { metric: ProofMetricModel }) {
  if (!metric.verified) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="font-display text-h2 font-bold text-foreground tabular-nums">
        {metric.prefix}
        {metric.value}
        {metric.suffix}
      </p>
      <p className="text-small text-foreground-muted">{metric.label}</p>
    </div>
  );
}
