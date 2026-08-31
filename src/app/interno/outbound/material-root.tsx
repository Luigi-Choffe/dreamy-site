"use client";

import { useEffect } from "react";

/**
 * Marca o <html> enquanto o console está montado (P2 #10 do plano): os toasts
 * vivem num portal no fim do <body>, fora do wrapper [data-app="console"], e
 * sem isto ficariam com o material do site público. O globals.css estende o
 * material de vidro para html[data-app-root="console"].
 */
export function MaterialRoot() {
  useEffect(() => {
    document.documentElement.setAttribute("data-app-root", "console");
    return () => document.documentElement.removeAttribute("data-app-root");
  }, []);
  return null;
}
