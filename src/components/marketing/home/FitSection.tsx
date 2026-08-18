import { Check } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/marketing/Reveal";
import { homeContent } from "@/content/home";

/** Home — Fit / ICP (PRD §24). Lista visual em seção escura. */
export function FitSection() {
  const { fit } = homeContent;
  return (
    <Section theme="dark" aria-labelledby="fit-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-6">
          <p className="eyebrow">Para quem</p>
          <h2 id="fit-title" className="mt-4 font-display text-h2 font-bold text-balance">
            {fit.title}
          </h2>
          <p className="measure mt-8 text-lead text-foreground-muted">{fit.closing}</p>
        </Reveal>
        <Reveal className="lg:col-span-6" delay={100}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {fit.items.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-small font-medium text-foreground"
              >
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
