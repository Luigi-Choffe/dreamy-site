"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atalhos de teclado do console (P1 #9 do plano de melhorias):
 * - "/" foca o primeiro campo de busca visível da página;
 * - Alt+1..9 navega para as primeiras nove abas (o title de cada aba anuncia).
 * Ignorados enquanto o foco está em campo de texto. Renderiza nada.
 */
export function AtalhosDoConsole({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement;

      if (e.key === "/" && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const busca = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (busca) {
          e.preventDefault();
          busca.focus();
        }
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !digitando && e.key >= "1" && e.key <= "9") {
        const href = hrefs[Number(e.key) - 1];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hrefs, router]);

  return null;
}
