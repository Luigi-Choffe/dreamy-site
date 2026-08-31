"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { AquarioChat } from "./aquario-chat";

/**
 * O MORK integrado ao console inteiro: botão flutuante no canto inferior
 * direito abre um painel de vidro GRANDE com o chat, em qualquer aba, sem
 * roubar largura do CRM (pedido do Luigi: chat maior e integrado; o Aquário
 * vive separado, na aba MORK). Estado aberto sobrevive à navegação na sessão.
 * Esc fecha. Herda o material de vidro do escopo do console.
 */
const CHAVE_ABERTO = "mork-chat-aberto";
let ouvintes: Array<() => void> = [];

function lerAberto(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_ABERTO) === "1";
  } catch {
    return false;
  }
}

/** O estado vive num store externo (sessionStorage) lido por useSyncExternalStore:
 *  hidrata sem cascata de renders e sobrevive à navegação entre abas do console. */
function gravarAberto(valor: boolean) {
  try {
    sessionStorage.setItem(CHAVE_ABERTO, valor ? "1" : "0");
  } catch {
    // sem sessionStorage (modo restrito): o estado apenas não persiste
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(cb: () => void) {
  ouvintes.push(cb);
  return () => {
    ouvintes = ouvintes.filter((o) => o !== cb);
  };
}

export function MorkFlutuante({ isDemo }: { isDemo: boolean }) {
  const aberto = useSyncExternalStore(assinar, lerAberto, () => false);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") gravarAberto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  return (
    <>
      {aberto ? (
        <div className="fixed right-4 bottom-20 z-50 w-[min(26rem,calc(100vw-2rem))] motion-safe:animate-rise-in">
          {/* Mais fosco que o vidro padrão: o chat abre SOBRE texto denso e precisa de legibilidade. */}
          <div className="overflow-hidden rounded-2xl border border-border bg-white/90 shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-flex size-6 items-center justify-center rounded-full font-display text-[0.55rem] font-extrabold text-[#052012]"
                  style={{
                    background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
                    boxShadow: "0 0 0 1px rgb(255 255 255 / 0.85)",
                  }}
                >
                  MK
                </span>
                <span className="text-xs font-bold tracking-wide text-foreground uppercase">MORK</span>
              </span>
              <button
                type="button"
                onClick={() => gravarAberto(false)}
                aria-label="Fechar o chat"
                className="grid size-7 place-items-center rounded-full text-foreground-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <AquarioChat isDemo={isDemo} alto />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => gravarAberto(!aberto)}
        aria-expanded={aberto}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pr-4 pl-1.5 text-small font-bold text-foreground shadow-lg transition-[box-shadow,transform] duration-(--duration-fast) ease-(--ease-out) hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-safe:hover:-translate-y-0.5"
      >
        <span
          aria-hidden
          className="inline-flex size-8 items-center justify-center rounded-full font-display text-[0.62rem] font-extrabold text-[#052012]"
          style={{
            background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
            boxShadow: "0 0 0 1px rgb(255 255 255 / 0.85), 0 6px 14px -6px rgb(15 124 71 / 0.45)",
          }}
        >
          MK
        </span>
        {aberto ? "Fechar" : "Pergunte ao MORK"}
      </button>
    </>
  );
}
