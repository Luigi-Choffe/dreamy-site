import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "header" | "footer" | "nav" | "article";
  size?: "default" | "narrow" | "wide";
}

/** Container centralizado (máx. 1280 px) com padding lateral fluido. */
export function Container({ as = "div", size = "default", className, ...props }: ContainerProps) {
  const Comp = as as "div";
  return (
    <Comp
      className={cn("container-x", size === "narrow" && "max-w-4xl", size === "wide" && "max-w-[88rem]", className)}
      {...props}
    />
  );
}
