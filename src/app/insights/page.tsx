import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { ArticleCard } from "@/components/content/ArticleCard";
import { Container } from "@/components/layout/Container";
import { Grid } from "@/components/layout/Grid";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Reveal } from "@/components/marketing/Reveal";
import { routes } from "@/config/site";
import { getPublishedInsights, isInsightsSectionLive } from "@/lib/content/collections";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "Insights: software sob medida, sistemas e IA aplicada | Dreamy",
  description:
    "Conteúdo para quem decide: quando um sistema sob medida faz sentido, como transformar base de clientes em produto digital e onde agentes de IA geram valor.",
  path: routes.insights,
});

/** /insights (PRD §33). Gate: mínimo de 3 publicados, senão 404 (ADR-008). */
export default function InsightsPage() {
  if (!isInsightsSectionLive()) notFound();
  const posts = getPublishedInsights();
  return (
    <>
      <section className="border-b border-border pt-8 pb-14 md:pt-10 md:pb-20">
        <Container>
          <Breadcrumbs items={[{ name: "Insights", path: routes.insights }]} />
          <div className="mt-8">
            <SectionHeading
              as="h1"
              size="h1"
              eyebrow="Insights"
              title="Tecnologia, decidida a partir do negócio."
              description="Artigos sobre software sob medida, sistemas internos, produtos digitais e IA aplicada — escritos para quem decide."
            />
          </div>
        </Container>
      </section>
      <Section aria-label="Artigos">
        <Grid cols={3}>
          {posts.map((p, i) => (
            <Reveal key={p.frontmatter.slug} delay={i * 60} className="h-full">
              <ArticleCard data={p.frontmatter} />
            </Reveal>
          ))}
        </Grid>
      </Section>
    </>
  );
}
