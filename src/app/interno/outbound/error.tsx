"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Error boundary do console (Next 16): erros de Server Action (validação, lock
 * ocupado por um CLI, contato inexistente) chegam aqui em vez da página genérica.
 * A mensagem original do erro é exibida (as actions lançam mensagens acionáveis).
 * Renderiza fora do ConsoleShell, então traz o próprio escopo de material.
 */
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      data-app="console"
      className="relative mx-auto grid min-h-[60vh] w-full max-w-2xl place-items-center px-6 py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "radial-gradient(44rem 26rem at 50% 0%, rgb(70 235 126 / 0.07), transparent 65%)" }}
      />
      <div className="surface-sheen relative w-full overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm md:p-8">
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-error/60" />
        <p className="eyebrow">Dreamy · plataforma de vendas</p>
        <h1 className="mt-2 font-display text-h4 font-bold">A ação não foi concluída</h1>
        <p className="mt-3 text-small break-words text-foreground-muted">
          {error.message || "Erro inesperado no console."}
        </p>
        <p className="mt-2 text-xs text-foreground-subtle">
          Se a mensagem falar em lock: um comando <code>outbound:*</code> está rodando no terminal. Espere terminar e
          tente de novo. Nada foi parcialmente aplicado.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button type="button" variant="secondary" size="sm" onClick={reset}>
            Tentar novamente
          </Button>
          <Link
            href="/interno/outbound"
            className="text-small font-semibold text-brand-strong underline-offset-4 hover:underline"
          >
            Voltar à visão geral
          </Link>
        </div>
      </div>
    </div>
  );
}
