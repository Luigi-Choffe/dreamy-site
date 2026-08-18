import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { Container } from "@/components/layout/Container";
import { Grid } from "@/components/layout/Grid";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { CTASection } from "@/components/marketing/CTASection";
import { Reveal } from "@/components/marketing/Reveal";
import { SolutionCard } from "@/components/marketing/SolutionCard";
import { routes } from "@/config/site";
import { homeContent } from "@/content/home";
import { solutions, solutionsIndexContent } from "@/content/solutions";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: solutionsIndexContent.seo.title,
  description: solutionsIndexContent.seo.description,
  path: routes.solutions,
});

/** Índice de soluções (PRD §13, §20). Exatamente três ofertas. */
export default function SolutionsIndexPage() {
  const { diagnosis } = homeContent;
  return (
    <>
      <section className="border-b border-border pt-8 pb-14 md:pt-10 md:pb-20">
        <Container>
          <Breadcrumbs items={[{ name: "Soluções", path: routes.solutions }]} />
          <div className="mt-8">
            <SectionHeading
              as="h1"
              size="h1"
              eyebrow={solutionsIndexContent.eyebrow}
              title={solutionsIndexContent.title}
              description={solutionsIndexContent.intro}
            />
          </div>
        </Container>
      </section>

      <Section theme="dark" aria-label="As três soluções">
        <Grid cols={3} gap="lg">
          {solutions.map((solution, i) => (
            <Reveal key={solution.slug} delay={i * 90} className="h-full">
              <SolutionCard solution={solution} ctaLocation="solutions_index" />
            </Reveal>
          ))}
        </Grid>
      </Section>

      <Section aria-labelledby="solucoes-diagnostico-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <p className="eyebrow">Diagnóstico</p>
            <h2 id="solucoes-diagnostico-title" className="mt-4 font-display text-h2 font-bold text-balance">
              {diagnosis.title}
            </h2>
          </Reveal>
          <Reveal className="flex flex-col gap-4 lg:col-span-7 lg:pt-2" delay={80}>
            {diagnosis.paragraphs.map((p) => (
              <p key={p} className="measure text-lead text-foreground-muted">
                {p}
              </p>
            ))}
          </Reveal>
        </div>
      </Section>

      <CTASection
        title={homeContent.finalCta.title}
        text={homeContent.finalCta.text}
        ctaLabel={homeContent.finalCta.cta.label}
        ctaHref={homeContent.finalCta.cta.href}
        ctaId="solutions_index_cta"
        ctaLocation="solutions_index"
        microcopy={homeContent.finalCta.microcopy}
        id="solucoes-cta-title"
      />
    </>
  );
}
