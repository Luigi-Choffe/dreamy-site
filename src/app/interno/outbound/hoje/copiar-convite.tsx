"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Um clique: copia a mensagem do convite (já com o nome) e abre o perfil no
 * LinkedIn em nova aba; o Luigi só cola. A aba abre ANTES de esperar a área de
 * transferência, porque alguns navegadores só permitem `window.open` dentro do
 * gesto do clique. Se o navegador negar a cópia (sem HTTPS, permissão), a
 * mensagem aparece abaixo para copiar à mão.
 */
export function CopiarConvite({ mensagem, url, className }: { mensagem: string; url: string; className: string }) {
  const [estado, setEstado] = useState<"idle" | "copiado" | "falhou">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function copiarEAbrir() {
    window.open(url, "_blank", "noopener,noreferrer");
    navigator.clipboard
      .writeText(mensagem)
      .then(() => setEstado("copiado"))
      .catch(() => setEstado("falhou"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado("idle"), 4000);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={copiarEAbrir} className={className} aria-live="polite">
        {estado === "copiado" ? "Copiado, é só colar" : estado === "falhou" ? "Copie abaixo" : "Copiar e abrir"}
        <span aria-hidden>↗</span>
        <span className="sr-only"> (copia a mensagem e abre o perfil em nova aba)</span>
      </button>
      {estado === "falhou" ? (
        <textarea
          readOnly
          value={mensagem}
          rows={3}
          className="w-64 rounded-lg border border-border bg-white/80 p-2 text-xs text-foreground"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
    </span>
  );
}
