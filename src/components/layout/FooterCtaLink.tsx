"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { trackCta, type CtaIntent } from "@/lib/analytics/events";

export function FooterCtaLink({
  href,
  ctaId,
  intent,
  external,
  children,
}: {
  href: string;
  ctaId: string;
  intent: CtaIntent;
  external?: boolean;
  children: ReactNode;
}) {
  const cls =
    "inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  const onClick = () => trackCta(ctaId, "footer", intent);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
        {children}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    );
  }
  return (
    <Link href={href} className={cls} onClick={onClick}>
      {children}
      <ArrowUpRight aria-hidden="true" className="size-4" />
    </Link>
  );
}
