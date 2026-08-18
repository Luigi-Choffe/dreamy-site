"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { routes } from "@/config/site";

/** Âncoras do site Framer antigo → novas rotas (docs/SEO-MIGRATION.md). Só atua na Home. */
const LEGACY_HASHES: Record<string, string> = {
  "#form": routes.contact,
  "#tools": routes.solutions,
  "#features": routes.howWeWork,
  "#integrations": routes.solutionAiAgents,
};

export function LegacyHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const target = LEGACY_HASHES[window.location.hash];
    if (target && window.location.pathname === "/") router.replace(target);
  }, [router]);
  return null;
}
