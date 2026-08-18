import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/marketing/Reveal";
import { homeContent } from "@/content/home";
import { cn } from "@/lib/utils/cn";

/**
 * Home — Diagnóstico (PRD §21): copy + fluxo vertical DOR → … → RESULTADO.
 * O fluxo é uma lista ordenada com trilha contínua (line drawing sutil via CSS).
 */
export function DiagnosisSection() {
  const { diagnosis } = homeContent;
  const steps = diagnosis.flow.steps;
  return (
    <Section theme="secondary" aria-labelledby="diagnostico-title">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <Reveal>
            <p className="eyebrow">Diagnóstico</p>
            <h2 id="diagnostico-title" className="mt-4 font-display text-h2 font-bold text-balance">
              {diagnosis.title}
            </h2>
          </Reveal>
          <div className="mt-8 flex flex-col gap-5">
            {diagnosis.paragraphs.map((p, i) => (
              <Reveal key={i} delay={60 + i * 60}>
                <p
                  className={cn(
                    "measure text-lead text-foreground-muted",
                    i === diagnosis.paragraphs.length - 1 && "font-medium text-foreground",
                  )}
                >
                  {p}
                </p>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="lg:col-span-5" delay={120}>
          <figure className="relative rounded-2xl border border-border bg-surface p-6 shadow-md md:p-8">
            <figcaption className="sr-only">{diagnosis.flow.title}</figcaption>
            <ol className="relative flex flex-col">
              {/* trilha vertical */}
              <span aria-hidden="true" className="absolute top-3 bottom-3 left-[1.15rem] w-px bg-border" />
              {steps.map((step, i) => {
                const last = i === steps.length - 1;
                return (
                  <li key={step.label} className={cn("relative flex items-center gap-4", !last && "pb-6")}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums",
                        last
                          ? "border-brand bg-brand text-brand-ink"
                          : "border-border bg-surface text-foreground-muted",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "font-display text-h4 font-bold tracking-wide uppercase",
                        last ? "text-brand-strong" : "text-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </figure>
        </Reveal>
      </div>
    </Section>
  );
}
