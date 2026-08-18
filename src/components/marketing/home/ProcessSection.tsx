import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { ProcessStep } from "@/components/marketing/ProcessStep";
import { Reveal } from "@/components/marketing/Reveal";
import { homeContent } from "@/content/home";

/** Home — Como trabalhamos (PRD §23). Âncora #como-trabalhamos usada pela navegação. */
export function ProcessSection() {
  const { process } = homeContent;
  return (
    <Section id={process.id} aria-labelledby="processo-title" className="scroll-mt-(--header-height)">
      <Reveal>
        <SectionHeading eyebrow={process.eyebrow} title={process.title} id="processo-title" />
      </Reveal>
      <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:mt-16 md:grid-cols-2 xl:grid-cols-5">
        {process.steps.map((step, i) => (
          <Reveal key={step.number} as="li" delay={i * 70} className="bg-surface">
            <ProcessStep {...step} last={i === process.steps.length - 1} />
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
