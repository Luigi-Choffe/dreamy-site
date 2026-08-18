"use client";

import { useEffect } from "react";
import { trackCta, type CtaIntent } from "@/lib/analytics/events";

/**
 * Delegação global de cliques em elementos com data-cta-id (Server Components podem
 * marcar links sem virar client). Atributos: data-cta-id, data-cta-location, data-intent.
 */
export function CtaClickDelegate() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cta-id]");
      if (!target) return;
      const id = target.dataset.ctaId;
      const location = target.dataset.ctaLocation ?? "unknown";
      const intent = (target.dataset.intent ?? "contact") as CtaIntent;
      if (id) trackCta(id, location, intent);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
