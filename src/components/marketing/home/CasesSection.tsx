import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Grid } from "@/components/layout/Grid";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { CaseCard } from "@/components/marketing/CaseCard";
import { Reveal } from "@/components/marketing/Reveal";
import { routes } from "@/config/site";
import { homeContent } from "@/content/home";
import { getPublishedCases } from "@/lib/content/collections";

/**
 * Home — Cases (PRD §22). Só existe com ≥ 1 case aprovado (ADR-008).
 * Com apenas um case, ele é exibido em destaque (PRD §13).
 */
export function CasesSection() {
  const cases = getPublishedCases();
  if (cases.length === 0) return null;
  const featured = cases.length === 1;
  const shown = cases.slice(0, 3);
  return (
    <Section aria-labelledby="cases-title" divider>
      <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading eyebrow="Cases" title={homeContent.cases.title} id="cases-title" />
        {!featured ? (
          <Link
            href={routes.cases}
            className="inline-flex items-center gap-1.5 text-small font-semibold text-brand-strong hover:underline"
          >
            Ver todos os cases <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </Reveal>
      {featured ? (
        <Reveal className="mt-12">
          <CaseCard data={shown[0].frontmatter} ctaLabel={homeContent.cases.cta} featured />
        </Reveal>
      ) : (
        <Grid cols={3} className="mt-12">
          {shown.map((c, i) => (
            <Reveal key={c.frontmatter.slug} delay={i * 80} className="h-full">
              <CaseCard data={c.frontmatter} ctaLabel={homeContent.cases.cta} />
            </Reveal>
          ))}
        </Grid>
      )}
    </Section>
  );
}
