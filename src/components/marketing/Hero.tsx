import { HeroSystemDiagram } from "@/components/diagrams/HeroSystemDiagram";
import { Container } from "@/components/layout/Container";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Eyebrow } from "@/components/ui/Badge";
import { homeContent } from "@/content/home";

/** Hero da Home (PRD §15–§16). Copy literal do PRD; visual próprio em SVG/CSS. */
export function Hero() {
  const { hero } = homeContent;
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-border bg-background pt-10 pb-16 md:pt-16 md:pb-24 lg:pt-20 lg:pb-28"
    >
      {/* fundo: grade sutil + brilho verde discreto */}
      <div
        aria-hidden="true"
        className="bg-grid-faint pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="glow-brand pointer-events-none absolute top-1/2 right-[-10%] hidden h-[42rem] w-[42rem] -translate-y-1/2 lg:block"
      />

      <Container className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex max-w-2xl flex-col gap-6">
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 id="hero-title" className="font-display text-display font-bold text-balance">
            {hero.title}
          </h1>
          <p className="measure text-lead text-foreground-muted">{hero.text}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <CtaLink
              href={hero.primaryCta.href}
              ctaId="hero_primary"
              ctaLocation="hero"
              intent="contact"
              size="lg"
              arrow
            >
              {hero.primaryCta.label}
            </CtaLink>
            <CtaLink
              href={hero.secondaryCta.href}
              ctaId="hero_secondary"
              ctaLocation="hero"
              intent="solutions"
              variant="secondary"
              size="lg"
            >
              {hero.secondaryCta.label}
            </CtaLink>
          </div>
          <p className="text-small text-foreground-subtle">{hero.microcopy}</p>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
          <HeroSystemDiagram title={hero.visual.title} />
        </div>
      </Container>
    </section>
  );
}
