import { FlowDiagram } from "@/components/diagrams/FlowDiagram";
import type { UseCase } from "@/content/types";
import { cn } from "@/lib/utils/cn";

/**
 * AgentFlow (PRD §62): fluxo de um caso de uso de agente (Cliente → agente → … → humano).
 * Especialização do FlowDiagram com o último passo destacado.
 */
export function AgentFlow({
  useCase,
  className,
  size = "md",
}: {
  useCase: UseCase;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("w-full", className)}>
      <FlowDiagram
        title={useCase.flow.title}
        steps={useCase.flow.steps}
        direction="vertical"
        size={size}
        highlightLast
      />
    </div>
  );
}
