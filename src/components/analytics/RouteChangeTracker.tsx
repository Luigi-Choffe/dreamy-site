"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/events";
import { captureAttribution } from "@/lib/analytics/attribution";

/**
 * Dispara `page_view` na carga inicial e em cada navegação SPA (docs/TRACKING.md).
 * Também captura atribuição (UTMs/referrer/landing) na primeira página.
 */
export function RouteChangeTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    captureAttribution();
    // aguarda o título atualizar após a navegação
    const id = window.requestAnimationFrame(() => {
      track({ event: "page_view", page: pathname, page_title: document.title });
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
