import { FlowDiagram } from "@/components/diagrams/FlowDiagram";
import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/marketing/Reveal";
import { homeContent } from "@/content/home";
import { cn } from "@/lib/utils/cn";

/**
 * Home — Diagnóstico (PRD §21): copy + fluxo vertical DOR → … → RESULTADO.
 * O fluxo é o rail numerado do FlowDiagram (a ordem aqui carrega informação).
 */
export function DiagnosisSection() {
  const { diagnosis } = homeContent;
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
          <div className="surface-sheen rounded-xl border border-border bg-surface p-6 shadow-md md:p-8">
            <p className="mb-6 text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase">
              {diagnosis.flow.title}
            </p>
            <FlowDiagram
              title={diagnosis.flow.title}
              steps={diagnosis.flow.steps}
              direction="vertical"
              size="lg"
              numbered
              highlightLast
            />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
