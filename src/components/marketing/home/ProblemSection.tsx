import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/marketing/Reveal";
import { homeContent } from "@/content/home";

/** Home — O problema (PRD §19). Bloco editorial, sem cards. */
export function ProblemSection() {
  const { problem } = homeContent;
  return (
    <Section aria-labelledby="problema-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <h2 id="problema-title" className="font-display text-h2 font-bold text-balance">
            {problem.title}
          </h2>
        </Reveal>
        <div className="lg:col-span-7 lg:pt-2">
          <Reveal delay={80}>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {problem.lines.map((line) => (
                <li key={line} className="py-3.5 text-h4 font-medium text-foreground md:py-4">
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={160} className="mt-8 flex flex-col gap-4">
            <p className="measure text-lead text-foreground-muted">{problem.closing}</p>
            <p className="font-display text-h3 font-bold text-brand-strong">{problem.punchline}</p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
