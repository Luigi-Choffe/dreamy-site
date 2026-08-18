import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { RichText } from "@/components/content/RichText";
import { JsonLd } from "@/components/content/JsonLd";
import { ArticleCard } from "@/components/content/ArticleCard";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { CTASection } from "@/components/marketing/CTASection";
import { Reveal } from "@/components/marketing/Reveal";
import { Eyebrow } from "@/components/ui/Badge";
import { routes } from "@/config/site";
import { getInsightBySlug, getPublishedInsights, isInsightsSectionLive } from "@/lib/content/collections";
import { renderMdx } from "@/lib/content/mdx";
import { articleJsonLd } from "@/lib/seo/jsonld";
import { createPageMetadata } from "@/lib/seo/metadata";
import { formatDatePtBr } from "@/lib/utils/date";
import { formatReadingTime, readingMinutes } from "@/lib/utils/reading-time";

interface Params {
  slug: string;
}

export function generateStaticParams(): Params[] {
  if (!isInsightsSectionLive()) return [];
  return getPublishedInsights().map((i) => ({ slug: i.frontmatter.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const entry = getInsightBySlug(slug);
  if (!entry) return {};
  const fm = entry.frontmatter;
  return createPageMetadata({
    title: fm.seo.title ?? `${fm.title} | Dreamy`,
    description: fm.seo.description ?? fm.description,
    path: `${routes.insights}/${fm.slug}`,
    type: "article",
    publishedTime: fm.date,
    modifiedTime: fm.updatedAt,
    authors: [fm.author],
    ...(fm.image
      ? { image: { url: fm.image.src, width: fm.image.width, height: fm.image.height, alt: fm.image.alt } }
      : {}),
  });
}

/** Artigo (PRD §33, §49): Article + BreadcrumbList. */
export default async function InsightPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const entry = getInsightBySlug(slug);
  if (!entry) notFound();
  const fm = entry.frontmatter;
  const body = await renderMdx(entry.body);
  const path = `${routes.insights}/${fm.slug}`;
  const minutes = readingMinutes(entry.body);
  const related = getPublishedInsights()
    .filter((i) => i.frontmatter.slug !== fm.slug)
    .slice(0, 2);

  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: fm.title,
          description: fm.description,
          path,
          datePublished: fm.date,
          dateModified: fm.updatedAt,
          author: fm.author,
          image: fm.image?.src,
        })}
      />
      <article className="pt-8 pb-20 md:pt-10 md:pb-28">
        <Container size="narrow">
          <Breadcrumbs
            items={[
              { name: "Insights", path: routes.insights },
              { name: fm.title, path },
            ]}
          />
          <header className="mt-8 flex flex-col gap-5">
            <Eyebrow>Insights</Eyebrow>
            <h1 className="font-display text-h1 font-bold text-balance">{fm.title}</h1>
            <p className="text-lead text-foreground-muted">{fm.description}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-small text-foreground-subtle">
              <p>
                <time dateTime={fm.date}>{formatDatePtBr(fm.date)}</time> · {fm.author} · {formatReadingTime(minutes)}
                {fm.updatedAt ? ` · atualizado em ${formatDatePtBr(fm.updatedAt)}` : null}
              </p>
              {fm.tags.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Temas">
                  {fm.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-brand-soft px-2.5 py-1 text-xs leading-none font-semibold text-brand-strong"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </header>
          {fm.image ? (
            <div className="mt-10 overflow-hidden rounded-2xl border border-border">
              <Image
                src={fm.image.src}
                alt={fm.image.alt}
                width={fm.image.width}
                height={fm.image.height}
                priority
                sizes="(min-width: 1024px) 896px, 100vw"
                className="h-auto w-full"
              />
            </div>
          ) : null}
          <RichText className="mt-10">{body}</RichText>
        </Container>
      </article>
      {related.length ? (
        <Section theme="secondary" padding="compact" aria-labelledby="related-insights-title">
          <h2 id="related-insights-title" className="font-display text-h3 font-bold">
            Mais insights
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {related.map((r, i) => (
              <Reveal key={r.frontmatter.slug} delay={i * 60} className="h-full">
                <ArticleCard
                  data={r.frontmatter}
                  readingMinutes={readingMinutes(r.body)}
                  ctaLocation="insight_related"
                />
              </Reveal>
            ))}
          </div>
        </Section>
      ) : null}
      <CTASection
        title="Quer aplicar isso na sua empresa?"
        text="Conte o contexto. Vamos entender o problema e avaliar o que faz sentido construir."
        ctaLabel="Conversar com a Dreamy"
        ctaHref={routes.contact}
        ctaId={`insight_cta_${fm.slug}`}
        ctaLocation="insight"
        id="insight-cta-title"
      />
    </>
  );
}
