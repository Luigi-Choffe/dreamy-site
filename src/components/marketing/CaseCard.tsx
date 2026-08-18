import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/site";
import type { CaseFrontmatter } from "@/lib/content/schemas";
import { cn } from "@/lib/utils/cn";

interface CaseCardProps {
  data: CaseFrontmatter;
  ctaLabel?: string;
  className?: string;
  /** Layout grande (case em destaque na Home) */
  featured?: boolean;
}

/**
 * Card de case (PRD §22, §30): Cliente · Setor · Problema · O que construímos · Resultado.
 * Sem frases promocionais vagas; resultado sempre com explicação/indicador verificável.
 */
export function CaseCard({ data, ctaLabel = "Ver case", className, featured = false }: CaseCardProps) {
  const href = `${routes.cases}/${data.slug}`;
  return (
    <Card as="article" interactive padding="none" className={cn("flex h-full flex-col overflow-hidden", className)}>
      {data.cover ? (
        <div
          className={cn(
            "relative border-b border-border bg-background-secondary",
            featured ? "aspect-[16/8]" : "aspect-[16/9]",
          )}
        >
          <Image
            src={data.cover.src}
            alt={data.cover.alt}
            fill
            sizes={featured ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"}
            className="object-cover"
          />
        </div>
      ) : null}
      <div className={cn("flex flex-1 flex-col gap-5 p-6 md:p-7", featured && "lg:p-9")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase">
          <span className="text-brand-strong">{data.client}</span>
          <span aria-hidden="true">·</span>
          <span>{data.sector}</span>
        </div>
        <h3 className={cn("font-display font-bold text-balance", featured ? "text-h3" : "text-h4")}>
          <Link
            href={href}
            data-cta-id={`case_card_${data.slug}`}
            data-cta-location="cases"
            data-intent="case"
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {data.summary}
          </Link>
        </h3>
        <dl className="grid gap-4 text-small sm:grid-cols-3">
          <div>
            <dt className="mb-1 font-semibold text-foreground">Problema</dt>
            <dd className="text-foreground-muted">{data.problem}</dd>
          </div>
          <div>
            <dt className="mb-1 font-semibold text-foreground">O que construímos</dt>
            <dd className="text-foreground-muted">{data.solution}</dd>
          </div>
          <div>
            <dt className="mb-1 font-semibold text-foreground">Resultado</dt>
            <dd className="text-foreground-muted">{data.result}</dd>
          </div>
        </dl>
        <span
          aria-hidden="true"
          className="mt-auto inline-flex items-center gap-1.5 pt-2 text-small font-semibold text-brand-strong"
        >
          {ctaLabel}
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Card>
  );
}
