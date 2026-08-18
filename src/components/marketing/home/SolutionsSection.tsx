import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Reveal } from "@/components/marketing/Reveal";
import { SolutionCardsGrid } from "@/components/marketing/SolutionCard";
import { homeContent } from "@/content/home";
import { solutions } from "@/content/solutions";

/** Home — Três soluções (PRD §20). Seção escura para variação de ritmo (PRD §59). */
export function SolutionsSection() {
  return (
    <Section theme="dark" aria-labelledby="solucoes-title" id="solucoes">
      <Reveal>
        <SectionHeading eyebrow="Soluções" title={homeContent.solutions.title} id="solucoes-title" />
      </Reveal>
      <SolutionCardsGrid solutions={[...solutions]} className="mt-12 md:mt-16" />
    </Section>
  );
}
