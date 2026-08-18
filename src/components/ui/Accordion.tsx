"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AccordionItem {
  id?: string;
  title: ReactNode;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Permite mais de um item aberto ao mesmo tempo. */
  multiple?: boolean;
  defaultOpen?: number[];
  className?: string;
  /** Renderiza cada item como <h3> (padrão) — mantém hierarquia semântica sob o H2 da seção. */
  headingLevel?: "h3" | "h4";
}

/**
 * Accordion acessível (padrão WAI-ARIA disclosure): botão com aria-expanded/aria-controls,
 * conteúdo em região rotulada, animação por CSS grid (sem medir alturas), teclado nativo.
 */
export function Accordion({
  items,
  multiple = false,
  defaultOpen = [],
  className,
  headingLevel = "h3",
}: AccordionProps) {
  const baseId = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set(defaultOpen));
  const Heading = headingLevel;

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(multiple ? prev : []);
      if (prev.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className={cn("divide-y divide-border border-y border-border", className)}>
      {items.map((item, index) => {
        const isOpen = open.has(index);
        const buttonId = `${baseId}-btn-${index}`;
        const panelId = `${baseId}-panel-${index}`;
        return (
          <div key={item.id ?? index} className="group/acc">
            <Heading className="m-0 text-base font-normal">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className={cn(
                  "flex w-full items-start justify-between gap-6 py-5 text-left md:py-6",
                  "font-display text-h4 font-semibold text-foreground transition-colors duration-(--duration-fast)",
                  "hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus",
                )}
              >
                <span>{item.title}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 grid size-7 shrink-0 place-items-center rounded-full border border-border text-foreground-muted",
                    "transition-[transform,background-color,border-color,color] duration-(--duration-base) ease-(--ease-out)",
                    isOpen && "rotate-45 border-brand-strong bg-brand-soft text-brand-strong",
                  )}
                >
                  <Plus className="size-4" />
                </span>
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-(--duration-base) ease-(--ease-out)",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="measure pb-6 text-body text-foreground-muted">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
