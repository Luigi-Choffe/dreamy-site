import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { Container } from "@/components/layout/Container";
import { Grid } from "@/components/layout/Grid";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { CaseCard } from "@/components/marketing/CaseCard";
import { CTASection } from "@/components/marketing/CTASection";
import { Reveal } from "@/components/marketing/Reveal";
import { routes } from "@/config/site";
import { homeContent } from "@/content/home";
import { getPublishedCases } from "@/lib/content/collections";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "Cases: tecnologia aplicada a problemas reais | Dreamy",
  description:
    "Problemas reais de empresas e a tecnologia construída para resolvê-los: contexto, problema, solução e resultado verificável.",
  path: routes.cases,
});

/**
 * /cases (PRD §30). Gate: sem case aprovado → 404 (ADR-008).
 * Não é portfólio de design: cada card mostra raciocínio de negócio.
 */
export default function CasesPage() {
  const cases = getPublishedCases();
  if (cases.length === 0) notFound();

  return (
    <>
      <section className="border-b border-border pt-8 pb-14 md:pt-10 md:pb-20">
        <Container>
          <Breadcrumbs items={[{ name: "Cases", path: routes.cases }]} />
          <div className="mt-8">
            <SectionHeading
              as="h1"
              size="h1"
              eyebrow="Cases"
              title="Tecnologia aplicada a problemas reais."
              description="Cada case apresenta contexto, problema, o que foi construído e o resultado — sem promessas vagas."
            />
          </div>
        </Container>
      </section>
      <Section aria-label="Lista de cases">
        <Grid cols={cases.length === 1 ? 1 : cases.length === 2 ? 2 : 3}>
          {cases.map((c, i) => (
            <Reveal key={c.frontmatter.slug} delay={i * 70} className="h-full">
              <CaseCard data={c.frontmatter} ctaLabel={homeContent.cases.cta} featured={cases.length === 1} />
            </Reveal>
          ))}
        </Grid>
      </Section>
      <CTASection
        title="Existe algo parecido na sua empresa?"
        text="Conte o contexto. Vamos entender o problema e avaliar o que faz sentido construir."
        ctaLabel="Conversar com a Dreamy"
        ctaHref={routes.contact}
        ctaId="cases_index_cta"
        ctaLocation="cases_index"
        id="cases-cta-title"
      />
    </>
  );
}
