import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { CTASection } from "@/components/marketing/CTASection";
import { ProcessStep } from "@/components/marketing/ProcessStep";
import { Reveal } from "@/components/marketing/Reveal";
import { Eyebrow } from "@/components/ui/Badge";
import { routes } from "@/config/site";
import { aboutContent } from "@/content/about";
import { homeContent } from "@/content/home";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: aboutContent.seo.title,
  description: aboutContent.seo.description,
  path: routes.about,
});

/** Sobre (PRD §32): posicionamento + princípios. Sem métricas, sem depoimentos. */
export default function AboutPage() {
  return (
    <>
      <section className="border-b border-border pt-8 pb-16 md:pt-10 md:pb-24">
        <Container>
          <Breadcrumbs items={[{ name: "Sobre", path: routes.about }]} />
          <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="flex flex-col gap-6 lg:col-span-7">
              <Eyebrow>{aboutContent.eyebrow}</Eyebrow>
              <h1 className="font-display text-h1 font-bold text-balance">{aboutContent.title}</h1>
            </div>
            <div className="flex flex-col gap-5 lg:col-span-5 lg:pt-12">
              {aboutContent.paragraphs.map((p, i) => (
                <p
                  key={p}
                  className={
                    i === aboutContent.paragraphs.length - 1
                      ? "font-display text-h4 font-bold text-foreground"
                      : "text-lead text-foreground-muted"
                  }
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <Section theme="dark" aria-labelledby="principios-title">
        <Reveal>
          <Eyebrow>{aboutContent.principlesTitle}</Eyebrow>
          <h2 id="principios-title" className="mt-4 max-w-[22ch] font-display text-h2 font-bold text-balance">
            O que orienta a forma como trabalhamos.
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 xl:grid-cols-5">
          {aboutContent.principles.map((p, i) => (
            <Reveal key={p.title} as="li" delay={i * 70} className="bg-surface">
              <div className="flex h-full flex-col gap-4 p-6 md:p-7">
                <span className="font-display text-h3 font-bold text-brand-strong tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-h4 font-bold">{p.title}</h3>
                <p className="text-small text-foreground-muted">{p.description}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section aria-labelledby="sobre-processo-title">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <Eyebrow>{aboutContent.howWeWork.title}</Eyebrow>
            <h2 id="sobre-processo-title" className="mt-4 font-display text-h2 font-bold text-balance">
              {homeContent.process.title}
            </h2>
            <p className="measure mt-4 text-lead text-foreground-muted">{aboutContent.howWeWork.text}</p>
          </Reveal>
          <Link
            href={aboutContent.howWeWork.cta.href}
            className="inline-flex items-center gap-1.5 text-small font-semibold text-brand-strong hover:underline"
          >
            {aboutContent.howWeWork.cta.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 xl:grid-cols-5">
          {homeContent.process.steps.map((step, i) => (
            <Reveal key={step.number} as="li" delay={i * 60} className="bg-surface">
              <ProcessStep {...step} last={i === homeContent.process.steps.length - 1} />
            </Reveal>
          ))}
        </ol>
      </Section>

      <CTASection
        title={aboutContent.cta.title}
        text={aboutContent.cta.text}
        ctaLabel={aboutContent.cta.label}
        ctaHref={aboutContent.cta.href}
        ctaId="about_cta"
        ctaLocation="about"
        id="sobre-cta-title"
      />
    </>
  );
}
