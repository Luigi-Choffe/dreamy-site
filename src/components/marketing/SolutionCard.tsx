import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FlowDiagram } from "@/components/diagrams/FlowDiagram";
import { Card } from "@/components/ui/Card";
import type { Solution } from "@/content/types";
import { routes } from "@/config/site";
import { cn } from "@/lib/utils/cn";

interface SolutionCardProps {
  solution: Solution;
  /** Exibe o mini-diagrama do produto (PRD §61). */
  showVisual?: boolean;
  className?: string;
  /** Local do CTA para tracking (data attribute lido pelo cliente). */
  ctaLocation?: string;
}

/**
 * Card de solução (Home e /solucoes). Todo o card é clicável através do link do título
 * (pseudo-elemento), mantendo um único link acessível + CTA textual visível.
 */
export function SolutionCard({
  solution,
  showVisual = true,
  className,
  ctaLocation = "home_solutions",
}: SolutionCardProps) {
  const href = `${routes.solutions}/${solution.slug}`;
  return (
    <Card as="article" interactive padding="lg" className={cn("flex h-full flex-col gap-6", className)}>
      <div className="flex items-center justify-between">
        <span className="font-display text-h4 font-bold text-brand-strong tabular-nums">{solution.order}</span>
        <span className="text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase">
          {solution.name}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-h3 font-bold text-balance">
          <Link
            href={href}
            data-cta-id={`solution_card_${solution.slug}`}
            data-cta-location={ctaLocation}
            data-intent={`solution:${solution.slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {solution.cardTitle}
          </Link>
        </h3>
        <p className="text-body text-foreground-muted">{solution.description}</p>
      </div>
      {showVisual ? (
        <div className="mt-auto rounded-lg border border-border bg-background-secondary/60 p-3">
          <FlowDiagram
            title={solution.visual.title}
            steps={solution.visual.steps}
            direction="vertical"
            size="sm"
            highlightLast
          />
        </div>
      ) : null}
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-1.5 text-small font-semibold text-brand-strong transition-[gap] group-hover:gap-2.5"
      >
        {solution.cardCta}
        <ArrowRight className="size-4" />
      </span>
    </Card>
  );
}
