import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "brand" | "neutral" | "outline" | "success" | "error";

const variants: Record<BadgeVariant, string> = {
  brand: "bg-brand-soft text-brand-strong",
  neutral: "bg-background-secondary text-foreground-muted",
  outline: "border border-border text-foreground-muted",
  success: "bg-brand-soft text-success",
  error: "bg-error-soft text-error",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-semibold",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Eyebrow padronizado (rótulo curto acima de títulos). */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("eyebrow", className)} {...props} />;
}
