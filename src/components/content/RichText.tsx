import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** RichText (PRD §62): container tipográfico para conteúdo longo (MDX, políticas). */
export function RichText({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("prose-dreamy", className)}>{children}</div>;
}
