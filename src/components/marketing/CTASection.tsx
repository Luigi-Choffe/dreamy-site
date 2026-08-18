import { Section } from "@/components/layout/Section";
import { AmbientDiscs } from "@/components/marketing/AmbientDiscs";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Reveal } from "@/components/marketing/Reveal";
import type { CtaIntent } from "@/lib/analytics/events";
import { cn } from "@/lib/utils/cn";

interface CTASectionProps {
  title: string;
  text?: string;
  ctaLabel: string;
  ctaHref: string;
  ctaId: string;
  ctaLocation?: string;
  intent?: CtaIntent;
  microcopy?: string;
  theme?: "dark" | "light" | "secondary";
  /** id do heading (para aria-labelledby) */
  id?: string;
  className?: string;
}

/** Faixa de CTA reutilizável (Home §26, soluções, sobre, cases). */
export function CTASection({
  title,
  text,
  ctaLabel,
  ctaHref,
  ctaId,
  ctaLocation = "cta_section",
  intent = "contact",
  microcopy,
  theme = "dark",
  id = "cta-title",
  className,
}: CTASectionProps) {
  return (
    <Section theme={theme} aria-labelledby={id} className={cn("overflow-hidden", className)}>
      <AmbientDiscs
        className="top-1/2 left-1/2 w-[46rem] max-w-none -translate-x-1/2 -translate-y-1/2 sm:w-[56rem]"
        intensity="soft"
      />
      <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <h2 id={id} className="font-display text-h2 font-bold text-balance">
          {title}
        </h2>
        {text ? <p className="measure text-lead text-foreground-muted">{text}</p> : null}
        <div className="mt-2">
          <CtaLink href={ctaHref} ctaId={ctaId} ctaLocation={ctaLocation} intent={intent} size="lg" arrow>
            {ctaLabel}
          </CtaLink>
        </div>
        {microcopy ? <p className="text-small text-foreground-subtle">{microcopy}</p> : null}
      </Reveal>
    </Section>
  );
}
