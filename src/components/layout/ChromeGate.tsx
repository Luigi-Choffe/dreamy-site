"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Porteiro do chrome público (Header/Footer/ConsentBanner): o console interno
 * (/interno) é um APP e tem chrome próprio; navegação de marketing, rodapé
 * institucional e banner de cookies não pertencem a ele. Client leaf mínimo:
 * os children continuam Server Components renderizados no layout raiz.
 */
export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/interno" || pathname.startsWith("/interno/")) return null;
  return <>{children}</>;
}
