import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "ul" | "ol";
  cols?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
}

const colClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};
const gapClasses = { sm: "gap-4", md: "gap-5 md:gap-6", lg: "gap-6 md:gap-8" };

/** Grid responsivo mobile-first. */
export function Grid({ as = "div", cols = 3, gap = "md", className, ...props }: GridProps) {
  const Comp = as as "div";
  return <Comp className={cn("grid", colClasses[cols], gapClasses[gap], className)} {...props} />;
}
