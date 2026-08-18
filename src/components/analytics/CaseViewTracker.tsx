"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/events";

/** Dispara `case_view` ao montar a página de case. */
export function CaseViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    track({ event: "case_view", case_slug: slug });
  }, [slug]);
  return null;
}
