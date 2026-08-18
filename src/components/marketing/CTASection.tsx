import { Section } from "@/components/layout/Section";
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
      <div
        aria-hidden="true"
        className="glow-brand pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 opacity-70"
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
