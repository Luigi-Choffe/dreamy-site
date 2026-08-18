import type { z } from "zod";
import type { caseMetricSchema } from "@/lib/content/schemas";

type Metric = z.infer<typeof caseMetricSchema>;

/**
 * Métrica de case (PRD §22, §31): só valores verificáveis (sourceRef obrigatório no schema).
 * Aceita resultado operacional "antes/depois" quando não há número.
 */
export function CaseMetric({ label, value, before, after }: Metric) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase">{label}</p>
      <p className="font-display text-h3 font-bold text-foreground">{value}</p>
      {before || after ? (
        <dl className="mt-1 grid gap-2 text-small">
          {before ? (
            <div>
              <dt className="inline font-semibold text-foreground">Antes: </dt>
              <dd className="inline text-foreground-muted">{before}</dd>
            </div>
          ) : null}
          {after ? (
            <div>
              <dt className="inline font-semibold text-foreground">Depois: </dt>
              <dd className="inline text-foreground-muted">{after}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
