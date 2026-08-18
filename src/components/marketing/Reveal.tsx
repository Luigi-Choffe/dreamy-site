"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** atraso em ms (stagger manual) */
  delay?: number;
  /** deslocamento vertical inicial em px */
  y?: number;
  as?: "div" | "section" | "li" | "article" | "span";
}

/**
 * Reveal on scroll (PRD §60: fade + translate curto) sem biblioteca (ADR-003):
 * - HTML servido sempre visível (sem JS ou com falha de hidratação, nada fica oculto);
 * - após hidratar, elementos ainda fora da viewport recebem `data-reveal="hidden"` e são
 *   revelados por IntersectionObserver (`data-reveal="visible"`, transição em CSS);
 * - elementos já visíveis na carga não animam (protege o LCP);
 * - prefers-reduced-motion desativa tudo via CSS.
 */
export function Reveal({ children, className, delay = 0, y = 18, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const Comp = as as "div";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    if (alreadyVisible) return;

    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.reveal = "visible";
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = { "--reveal-y": `${y}px`, "--reveal-delay": `${delay}ms` } as CSSProperties;

  return (
    <Comp ref={ref as React.RefObject<HTMLDivElement>} className={className} style={style}>
      {children}
    </Comp>
  );
}
