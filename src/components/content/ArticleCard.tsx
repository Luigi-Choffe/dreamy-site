import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/site";
import type { InsightFrontmatter } from "@/lib/content/schemas";
import { formatDatePtBr } from "@/lib/utils/date";

/** Card de artigo (Insights). */
export function ArticleCard({ data }: { data: InsightFrontmatter }) {
  const href = `${routes.insights}/${data.slug}`;
  return (
    <Card as="article" interactive padding="none" className="flex h-full flex-col overflow-hidden">
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
      <div className="flex flex-1 flex-col gap-3 p-6">
        <p className="text-xs text-foreground-subtle">
          <time dateTime={data.date}>{formatDatePtBr(data.date)}</time>
          {data.author ? ` · ${data.author}` : null}
        </p>
        <h3 className="font-display text-h4 font-bold text-balance">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {data.title}
          </Link>
        </h3>
        <p className="text-small text-foreground-muted">{data.description}</p>
        <span
          aria-hidden="true"
          className="mt-auto inline-flex items-center gap-1.5 pt-2 text-small font-semibold text-brand-strong"
        >
          Ler artigo <ArrowRight className="size-4" />
        </span>
      </div>
    </Card>
  );
}
