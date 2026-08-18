import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { Container } from "./Container";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article" | "aside";
  /** `dark` aplica a paleta escura via data-theme (tokens semânticos). */
  theme?: "light" | "dark" | "secondary" | "inherit";
  padding?: "default" | "compact" | "none";
  container?: boolean | "narrow" | "wide";
  /** Borda superior sutil para separar seções de mesma cor. */
  divider?: boolean;
}

/** Seção de página com ritmo vertical consistente e tema por seção. */
export function Section({
  as = "section",
  theme = "inherit",
  padding = "default",
  container = true,
  divider = false,
  className,
  children,
  ...props
}: SectionProps) {
  const themeAttr = theme === "dark" ? "dark" : theme === "light" ? "light" : undefined;
  const Comp = as as "section";
  return (
    <Comp
      data-theme={themeAttr}
      className={cn(
        "relative",
        theme === "secondary" && "bg-background-secondary",
        (theme === "dark" || theme === "light") && "bg-background text-foreground",
        padding === "default" && "py-section",
        padding === "compact" && "py-section-compact",
        divider && "border-t border-border",
        className,
      )}
      {...props}
    >
      {container ? <Container size={container === true ? "default" : container}>{children}</Container> : children}
    </Comp>
  );
}
