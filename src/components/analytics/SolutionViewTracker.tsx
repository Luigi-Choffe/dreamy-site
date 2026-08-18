"use client";

import { useEffect } from "react";
import { track, type SolutionParam } from "@/lib/analytics/events";

/** Dispara `solution_view` ao montar a página de solução (docs/TRACKING.md). */
export function SolutionViewTracker({ solution }: { solution: SolutionParam }) {
  useEffect(() => {
    track({ event: "solution_view", solution });
  }, [solution]);
  return null;
}
