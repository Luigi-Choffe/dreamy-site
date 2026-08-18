import type { ProcessStep as ProcessStepModel } from "@/content/types";
import { cn } from "@/lib/utils/cn";

interface ProcessStepProps extends ProcessStepModel {
  last?: boolean;
  className?: string;
}

/** Etapa numerada do processo (PRD §23). */
export function ProcessStep({ number, title, description, last, className }: ProcessStepProps) {
  return (
    <div className={cn("flex h-full flex-col gap-4 p-6 md:p-7", className)}>
      <span
        className={cn(
          "font-display text-h3 font-bold tabular-nums",
          last ? "text-brand-strong" : "text-foreground-subtle",
        )}
      >
        {number}
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-h4 font-bold">{title}</h3>
        <p className="text-small text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}
