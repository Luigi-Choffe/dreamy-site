import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  size?: "h1" | "h2" | "display";
  className?: string;
  id?: string;
}

/** Cabeçalho de seção: eyebrow + título + descrição, com largura de leitura. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Tag = "h2",
  size = "h2",
  className,
  id,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" && "items-center text-center", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Tag
        id={id}
        className={cn(
          "font-display font-bold text-balance",
          size === "display" && "text-display",
          size === "h1" && "text-h1",
          size === "h2" && "text-h2",
          "max-w-[22ch]",
        )}
      >
        {title}
      </Tag>
      {description ? <div className="measure text-lead text-foreground-muted">{description}</div> : null}
    </div>
  );
}
