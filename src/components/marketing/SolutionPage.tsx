import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SolutionViewTracker } from "@/components/analytics/SolutionViewTracker";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { JsonLd } from "@/components/content/JsonLd";
import { AgentFlow } from "@/components/diagrams/AgentFlow";
import { FlowDiagram } from "@/components/diagrams/FlowDiagram";
import { SystemDiagram } from "@/components/diagrams/SystemDiagram";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { CTASection } from "@/components/marketing/CTASection";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Reveal } from "@/components/marketing/Reveal";
import { Eyebrow } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/site";
import { solutions } from "@/content/solutions";
import type { ListSection, Solution } from "@/content/types";
import { serviceJsonLd } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils/cn";

/* ------------------------------ helpers ---------------------------------- */

function PillList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-small font-medium text-foreground shadow-sm"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function CheckList({ items, columns = 2 }: { items: string[]; columns?: 1 | 2 }) {
  return (
    <ul className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-body text-foreground">
          <span
            aria-hidden="true"
            className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong"
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function TileList({ items }: { items: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3.5 text-small font-semibold text-foreground shadow-sm"
        >
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ListBlock({ section, variant = "check" }: { section: ListSection; variant?: "check" | "pill" | "tile" }) {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <Reveal className="lg:col-span-5">
        <h2 className="font-display text-h2 font-bold text-balance">{section.title}</h2>
        {section.intro ? <p className="measure mt-5 text-lead text-foreground-muted">{section.intro}</p> : null}
      </Reveal>
      <Reveal className="lg:col-span-7 lg:pt-3" delay={80}>
        {variant === "check" ? (
          <CheckList items={section.items} />
        ) : variant === "tile" ? (
          <TileList items={section.items} />
        ) : (
          <PillList items={section.items} />
        )}
        {section.note ? <p className="mt-5 text-small text-foreground-subtle">{section.note}</p> : null}
      </Reveal>
    </div>
  );
}

/* ------------------------------ página ----------------------------------- */

export function SolutionPage({ solution }: { solution: Solution }) {
  const path = `${routes.solutions}/${solution.slug}`;
  const others = solutions.filter((s) => s.slug !== solution.slug);
  const isAgents = solution.slug === "agentes-de-ia";

  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: solution.name,
          description: solution.seo.description,
          path,
          serviceType: solution.name,
        })}
      />
      <SolutionViewTracker solution={solution.slug} />

      {/* Hero */}
      <section
        aria-labelledby="solution-title"
        className="relative overflow-hidden border-b border-border bg-background pt-8 pb-16 md:pt-10 md:pb-24"
      >
        <div
          aria-hidden="true"
          className="glow-brand pointer-events-none absolute top-0 right-[-14%] hidden h-[38rem] w-[38rem] -translate-y-1/3 lg:block"
        />
        <Container className="relative">
          <Breadcrumbs
            items={[
              { name: "Soluções", path: routes.solutions },
              { name: solution.name, path },
            ]}
          />
          <div className="mt-8 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="flex max-w-2xl flex-col gap-6 lg:col-span-7">
              <Eyebrow>{solution.eyebrow}</Eyebrow>
              <h1 id="solution-title" className="font-display text-h1 font-bold text-balance">
                {solution.headline}
              </h1>
              <p className="measure text-lead text-foreground-muted">{solution.intro}</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <CtaLink
                  href={solution.cta.href}
                  ctaId={`solution_hero_${solution.slug}`}
                  ctaLocation="solution_hero"
                  intent="contact"
                  size="lg"
                  arrow
                >
                  {solution.cta.label}
                </CtaLink>
              </div>
            </div>
            <Reveal className="lg:col-span-5" delay={120}>
              <Card padding="md" className="bg-surface/80 backdrop-blur-sm">
                <p className="mb-4 text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase">
                  Como funciona
                </p>
                <FlowDiagram
                  title={solution.visual.title}
                  steps={solution.visual.steps}
                  variant="card"
                  direction="vertical"
                  highlightLast
                />
              </Card>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Problema */}
      <Section aria-label={solution.problem.title}>
        <ListBlock section={solution.problem} variant={isAgents ? "check" : "tile"} />
      </Section>

      {/* Mensagem fundamental (Sistemas) */}
      {solution.message ? (
        <Section theme="dark" padding="compact" aria-labelledby="solution-message-title">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 id="solution-message-title" className="font-display text-h2 font-bold text-balance">
              {solution.message.title}
            </h2>
            <div className="mt-6 flex flex-col gap-3">
              {solution.message.paragraphs.map((p) => (
                <p key={p} className="text-lead text-foreground-muted">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </Section>
      ) : null}

      {/* Solução (Nova Receita) */}
      {solution.solution ? (
        <Section theme="secondary" aria-label={solution.solution.title}>
          <ListBlock section={solution.solution} variant="tile" />
        </Section>
      ) : null}

      {/* Casos de uso (Agentes) */}
      {solution.useCases ? (
        <Section theme="secondary" aria-labelledby="usecases-title">
          <Reveal>
            <SectionHeading eyebrow="Casos de uso" title="Onde um agente pode trabalhar?" id="usecases-title" />
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {solution.useCases.map((uc, i) => (
              <Reveal key={uc.id} delay={i * 80} className="h-full">
                <Card as="article" padding="lg" className="flex h-full flex-col gap-6">
                  <h3 className="font-display text-h3 font-bold">{uc.title}</h3>
                  <AgentFlow useCase={uc} />
                  <ul className="mt-auto flex flex-wrap gap-1.5 border-t border-border pt-5">
                    {uc.tasks.map((t) => (
                      <li
                        key={t}
                        className="rounded-full bg-background-secondary px-2.5 py-1 text-xs font-medium text-foreground-muted"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Princípios / segurança (Agentes) */}
      {solution.principles ? (
        <Section theme="dark" aria-label={solution.principles.title}>
          <ListBlock section={solution.principles} variant="check" />
        </Section>
      ) : null}

      {/* Integrações (Agentes) */}
      {solution.integrations ? (
        <Section aria-labelledby="integrations-title">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <h2 id="integrations-title" className="font-display text-h2 font-bold text-balance">
                {solution.integrations.title}
              </h2>
              {solution.integrations.intro ? (
                <p className="measure mt-5 text-lead text-foreground-muted">{solution.integrations.intro}</p>
              ) : null}
            </Reveal>
            <Reveal className="lg:col-span-7" delay={100}>
              <SystemDiagram
                title="Diagrama: agente conectado a CRM, ERP, WhatsApp, e-mail, banco de dados, documentos e APIs."
                center="Agente"
                centerDetail="contexto da empresa"
                nodes={solution.integrations.nodes}
              />
            </Reveal>
          </div>
        </Section>
      ) : null}

      {/* Exemplos (discretos) */}
      {solution.examples ? (
        <Section divider aria-label={solution.examples.title}>
          <ListBlock section={solution.examples} variant="pill" />
        </Section>
      ) : null}

      {/* Pergunta estratégica (Nova Receita) */}
      {solution.highlight ? (
        <Section theme="dark" padding="compact" aria-labelledby="highlight-title">
          <Reveal className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6">Pergunta estratégica</p>
            <p id="highlight-title" className="font-display text-h2 font-bold text-balance">
              {solution.highlight}
            </p>
          </Reveal>
        </Section>
      ) : null}

      {/* Processo */}
      <Section theme="secondary" aria-labelledby="process-title">
        <Reveal>
          <SectionHeading eyebrow="Processo" title={solution.process.title} id="process-title" />
        </Reveal>
        <Reveal className="mt-10" delay={80}>
          <FlowDiagram title={solution.process.title} steps={solution.process.steps} highlightLast />
        </Reveal>
      </Section>

      {/* CTA */}
      <CTASection
        title={solution.highlight ? "Vamos explorar essa oportunidade?" : "Existe algo parecido na sua empresa?"}
        text="Conte o contexto. Vamos entender o problema e avaliar se existe uma solução capaz de gerar impacto relevante."
        ctaLabel={solution.cta.label}
        ctaHref={solution.cta.href}
        ctaId={`solution_final_${solution.slug}`}
        ctaLocation="solution_final"
        id="solution-cta-title"
      />

      {/* Outras soluções */}
      <Section padding="compact" divider aria-labelledby="other-solutions-title">
        <h2
          id="other-solutions-title"
          className="text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase"
        >
          Outras soluções
        </h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {others.map((s) => (
            <li key={s.slug}>
              <Link
                href={`${routes.solutions}/${s.slug}`}
                data-cta-id={`solution_cross_${s.slug}`}
                data-cta-location="solution_cross"
                data-intent={`solution:${s.slug}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-brand-strong">{s.order}</span>
                  <span className="font-display text-h4 font-bold">{s.name}</span>
                  <span className="text-small text-foreground-muted">{s.cardTitle}</span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
