import Image from "next/image";
import { notFound } from "next/navigation";
import { CaseViewTracker } from "@/components/analytics/CaseViewTracker";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { RichText } from "@/components/content/RichText";
import { CaseMetric } from "@/components/content/CaseMetric";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { CTASection } from "@/components/marketing/CTASection";
import { Eyebrow } from "@/components/ui/Badge";
import { routes } from "@/config/site";
import { getCaseBySlug, getPublishedCases } from "@/lib/content/collections";
import { renderMdx } from "@/lib/content/mdx";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Params {
  slug: string;
}

export function generateStaticParams(): Params[] {
  return getPublishedCases().map((c) => ({ slug: c.frontmatter.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const entry = getCaseBySlug(slug);
  if (!entry) return {};
  const fm = entry.frontmatter;
  return createPageMetadata({
    title: fm.seo.title ?? `${fm.client}: ${fm.summary} | Dreamy`,
    description: fm.seo.description ?? fm.summary,
    path: `${routes.cases}/${fm.slug}`,
    type: "article",
    publishedTime: fm.publishedAt,
    modifiedTime: fm.updatedAt,
    ...(fm.cover
      ? { image: { url: fm.cover.src, width: fm.cover.width, height: fm.cover.height, alt: fm.cover.alt } }
      : {}),
  });
}

/**
 * Case individual (PRD §31): Hero → 01 Contexto → 02 Problema → 03 Solução → 04 Como funciona
 * → 05 Resultado → 06 Produto → CTA. O corpo MDX traz as seções 01–04 e 06 (texto/diagramas/figuras).
 */
export default async function CasePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const entry = getCaseBySlug(slug);
  if (!entry) notFound();
  const fm = entry.frontmatter;
  const body = await renderMdx(entry.body);
  const path = `${routes.cases}/${fm.slug}`;

  return (
    <>
      <CaseViewTracker slug={fm.slug} />
      <article>
        <header className="border-b border-border pt-8 pb-14 md:pt-10 md:pb-20">
          <Container>
            <Breadcrumbs
              items={[
                { name: "Cases", path: routes.cases },
                { name: fm.client, path },
              ]}
            />
            <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="flex flex-col gap-5 lg:col-span-7">
                <Eyebrow>
                  {fm.client} · {fm.sector}
                </Eyebrow>
                <h1 className="font-display text-h1 font-bold text-balance">{fm.summary}</h1>
              </div>
              <dl className="grid gap-5 text-small lg:col-span-5 lg:pt-4">
                <div>
                  <dt className="font-semibold text-foreground">Problema</dt>
                  <dd className="mt-1 text-foreground-muted">{fm.problem}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">O que construímos</dt>
                  <dd className="mt-1 text-foreground-muted">{fm.solution}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Resultado</dt>
                  <dd className="mt-1 text-foreground-muted">{fm.result}</dd>
                </div>
              </dl>
            </div>
            {fm.cover ? (
              <div className="mt-12 overflow-hidden rounded-2xl border border-border">
                <Image
                  src={fm.cover.src}
                  alt={fm.cover.alt}
                  width={fm.cover.width}
                  height={fm.cover.height}
                  priority
                  sizes="(min-width: 1280px) 1200px, 100vw"
                  className="h-auto w-full"
                />
              </div>
            ) : null}
          </Container>
        </header>

        <Section aria-label="Detalhes do case">
          <RichText className="mx-auto">{body}</RichText>
        </Section>

        {fm.metrics.length > 0 ? (
          <Section theme="secondary" aria-labelledby="case-results-title">
            <Container size="narrow" className="px-0">
              <h2 id="case-results-title" className="font-display text-h2 font-bold">
                05 — Resultado
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {fm.metrics.map((m) => (
                  <CaseMetric key={m.sourceRef} {...m} />
                ))}
              </div>
            </Container>
          </Section>
        ) : null}

        {fm.images.length > 0 ? (
          <Section aria-labelledby="case-product-title">
            <h2 id="case-product-title" className="font-display text-h2 font-bold">
              06 — Produto
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {fm.images.map((img) => (
                <figure key={img.src} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    width={img.width}
                    height={img.height}
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="h-auto w-full"
                  />
                  {img.caption ? (
                    <figcaption className="p-3 text-xs text-foreground-subtle">{img.caption}</figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </Section>
        ) : null}
      </article>

      <CTASection
        title="Existe algo parecido na sua empresa?"
        text="Conte o contexto. Vamos entender o problema e avaliar o que faz sentido construir."
        ctaLabel="Conversar com a Dreamy"
        ctaHref={routes.contact}
        ctaId={`case_cta_${fm.slug}`}
        ctaLocation="case"
        id="case-cta-title"
      />
    </>
  );
}
