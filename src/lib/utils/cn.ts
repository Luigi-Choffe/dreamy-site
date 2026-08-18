import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge precisa conhecer os tamanhos de fonte customizados do tema
 * (text-display, text-h1…); caso contrário trata `text-small` como cor e
 * descarta a classe ao mesclar com `text-foreground-*`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "h4", "lead", "body", "small", "eyebrow"] }],
    },
  },
});

/** Combina classes condicionalmente e resolve conflitos de utilitários Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
