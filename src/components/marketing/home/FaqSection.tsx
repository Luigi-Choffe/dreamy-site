import { Section } from "@/components/layout/Section";
import { FAQ } from "@/components/marketing/FAQ";
import { Reveal } from "@/components/marketing/Reveal";
import { faqItems } from "@/content/faq";
import { homeContent } from "@/content/home";

/** Home — FAQ (PRD §25). */
export function FaqSection() {
  return (
    <Section aria-labelledby="faq-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow">FAQ</p>
          <h2 id="faq-title" className="mt-4 font-display text-h2 font-bold text-balance">
            {homeContent.faq.title}
          </h2>
        </Reveal>
        <Reveal className="lg:col-span-8" delay={80}>
          <FAQ items={faqItems} />
        </Reveal>
      </div>
    </Section>
  );
}
