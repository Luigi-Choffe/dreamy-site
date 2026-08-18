import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `interactive` adiciona hover/focus-within para cards clicáveis. */
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "article" | "li" | "section";
}

const paddings = {
  none: "",
  sm: "p-5",
  md: "p-6 md:p-7",
  lg: "p-7 md:p-9",
};

export function Card({ interactive, padding = "md", className, as = "div", ...props }: CardProps) {
  const Comp = as as "div";
  return (
    <Comp
      className={cn(
        "relative rounded-xl border border-border bg-surface text-foreground shadow-sm",
        "transition-[border-color,box-shadow,transform,background-color] duration-(--duration-base) ease-(--ease-out)",
        interactive &&
          "focus-within:border-brand-strong/50 focus-within:shadow-md hover:border-border-strong hover:shadow-md motion-safe:hover:-translate-y-0.5",
        paddings[padding],
        className,
      )}
      {...props}
    />
  );
}
