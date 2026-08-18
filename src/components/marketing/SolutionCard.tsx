import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FlowDiagram } from "@/components/diagrams/FlowDiagram";
import { Reveal } from "@/components/marketing/Reveal";
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
  /** Atraso do reveal (stagger). */
  revealDelay?: number;
}

/**
 * Card de solução (Home e /solucoes). O card é um item de subgrid com 4 linhas
 * (meta · título+texto · diagrama · CTA): lado a lado, as linhas de todos os cards
 * ficam alinhadas — os diagramas começam na mesma altura e os CTAs terminam juntos.
 * Todo o card é clicável através do link do título (pseudo-elemento), mantendo um
 * único link acessível + CTA textual visível.
 */
export function SolutionCard({
  solution,
  showVisual = true,
  className,
  ctaLocation = "home_solutions",
  revealDelay = 0,
}: SolutionCardProps) {
  const href = `${routes.solutions}/${solution.slug}`;
  return (
    <Reveal
      as="article"
      delay={revealDelay}
      className={cn(
        "group relative grid grid-rows-subgrid gap-0 rounded-xl border border-border bg-surface p-7 text-foreground shadow-sm md:p-8",
        showVisual ? "row-span-4" : "row-span-3",
        "surface-sheen transition-[border-color,box-shadow,transform] duration-(--duration-base) ease-(--ease-out)",
        "focus-within:border-brand-strong/50 focus-within:shadow-md hover:border-border-strong hover:shadow-md motion-safe:hover:-translate-y-0.5",
        className,
      )}
    >
      {/* brilho suave no canto (aparece no hover) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(28rem_18rem_at_100%_0%,rgb(70_235_126/0.10),transparent_60%)] opacity-0 transition-opacity duration-(--duration-slow) ease-(--ease-out) group-hover:opacity-100"
      />
      <div className="relative mb-7 flex items-center justify-between gap-4">
        <span className="font-display text-small font-bold text-brand-strong tabular-nums">{solution.order}</span>
        <span className="text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase">
          {solution.name}
        </span>
      </div>

      <div className="relative mb-7 flex flex-col gap-3">
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
        <div className="relative mb-7 flex items-center self-stretch rounded-xl border border-border bg-background-secondary/70 px-5 py-5 md:px-6 md:py-6">
          <FlowDiagram
            title={solution.visual.title}
            steps={solution.visual.steps}
            direction="vertical"
            size="md"
            highlightLast
          />
        </div>
      ) : null}

      <span
        aria-hidden="true"
        className="relative inline-flex items-center gap-1.5 self-end text-small font-semibold text-brand-strong transition-[gap] duration-(--duration-fast) group-hover:gap-2.5"
      >
        {solution.cardCta}
        <ArrowRight className="size-4" />
      </span>
    </Reveal>
  );
}

/** Grid das três soluções: cada card ocupa 4 linhas do subgrid; as linhas alinham entre cards. */
export function SolutionCardsGrid({
  solutions,
  ctaLocation,
  className,
}: {
  solutions: Solution[];
  ctaLocation?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8", className)}>
      {solutions.map((solution, i) => (
        <SolutionCard key={solution.slug} solution={solution} ctaLocation={ctaLocation} revealDelay={i * 90} />
      ))}
    </div>
  );
}
