"use client";

import { ArrowRight } from "lucide-react";
import { LinkButton, type LinkButtonProps } from "@/components/ui/Button";
import { trackCta, type CtaIntent } from "@/lib/analytics/events";

interface CtaLinkProps extends LinkButtonProps {
  ctaId: string;
  ctaLocation: string;
  intent: CtaIntent;
  /** Seta à direita (padrão true para CTAs primários). */
  arrow?: boolean;
}

/** LinkButton com tracking `cta_click` (docs/TRACKING.md). */
export function CtaLink({ ctaId, ctaLocation, intent, arrow = false, onClick, children, ...props }: CtaLinkProps) {
  return (
    <LinkButton
      {...props}
      onClick={(e) => {
        trackCta(ctaId, ctaLocation, intent);
        onClick?.(e);
      }}
      trailingIcon={
        arrow ? (
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-(--duration-fast) group-hover/btn:translate-x-0.5"
          />
        ) : undefined
      }
    >
      {children}
    </LinkButton>
  );
}
