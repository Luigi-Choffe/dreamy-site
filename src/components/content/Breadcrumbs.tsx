import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/content/JsonLd";
import { breadcrumbJsonLd, homeBreadcrumb, type BreadcrumbItem } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils/cn";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /** Inclui o JSON-LD BreadcrumbList (padrão true). */
  jsonLd?: boolean;
}

/** Trilha de navegação acessível + BreadcrumbList (PRD §49). */
export function Breadcrumbs({ items, className, jsonLd = true }: BreadcrumbsProps) {
  const all = [homeBreadcrumb, ...items];
  return (
    <>
      {jsonLd ? <JsonLd data={breadcrumbJsonLd(all)} /> : null}
      <nav aria-label="Trilha de navegação" className={cn("text-xs text-foreground-subtle", className)}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((item, index) => {
            const last = index === all.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-foreground-muted">
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.path}
                    className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {item.name}
                  </Link>
                )}
                {!last ? <ChevronRight aria-hidden="true" className="size-3.5" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
