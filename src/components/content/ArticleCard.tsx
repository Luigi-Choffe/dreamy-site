import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/site";
import type { InsightFrontmatter } from "@/lib/content/schemas";
import { formatDatePtBr } from "@/lib/utils/date";
import { formatReadingTime } from "@/lib/utils/reading-time";

interface ArticleCardProps {
  data: InsightFrontmatter;
  /** Tempo de leitura em minutos (calculado a partir do corpo pelo loader/página). */
  readingMinutes?: number;
  /** Local do CTA para tracking. */
  ctaLocation?: string;
}

/** Card de artigo (Insights): tags, título, resumo, data e tempo de leitura. */
export function ArticleCard({ data, readingMinutes, ctaLocation = "insights_index" }: ArticleCardProps) {
  const href = `${routes.insights}/${data.slug}`;
  const tags = data.tags.slice(0, 2);
  return (
    <Card as="article" interactive padding="none" className="group flex h-full flex-col overflow-hidden">
      {data.image ? (
        <div className="relative aspect-[16/9] border-b border-border bg-background-secondary">
          <Image
            src={data.image.src}
            alt={data.image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-6 md:p-7">
        {tags.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Temas">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-brand-soft px-2.5 py-1 text-xs leading-none font-semibold text-brand-strong"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <h3 className="font-display text-h4 font-bold text-balance">
          <Link
            href={href}
            data-cta-id={`insight_card_${data.slug}`}
            data-cta-location={ctaLocation}
            data-intent="insight"
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {data.title}
          </Link>
        </h3>
        <p className="text-small text-foreground-muted">{data.description}</p>
        <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-4">
          <p className="text-xs text-foreground-subtle">
            <time dateTime={data.date}>
              {formatDatePtBr(data.date, { day: "2-digit", month: "short", year: "numeric" })}
            </time>
            {readingMinutes ? ` · ${formatReadingTime(readingMinutes)}` : null}
          </p>
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 text-small font-semibold text-brand-strong transition-[gap] duration-(--duration-fast) group-hover:gap-2.5"
          >
            Ler artigo <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </Card>
  );
}
