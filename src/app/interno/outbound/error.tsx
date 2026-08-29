"use client";

/**
 * Error boundary do console (Next 16): erros de Server Action (validação, lock
 * ocupado por um CLI, contato inexistente) chegam aqui em vez da página genérica.
 * A mensagem original do erro é exibida — as actions lançam mensagens acionáveis.
 */
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold tracking-widest text-brand-strong uppercase">Dreamy Outbound</p>
      <h1 className="font-display mt-2 text-2xl font-bold">A ação não foi concluída</h1>
      <p className="mt-3 text-sm break-words text-foreground-muted">
        {error.message || "Erro inesperado no console."}
      </p>
      <p className="mt-2 text-xs text-foreground-subtle">
        Se a mensagem falar em lock: um comando <code>outbound:*</code> está rodando no terminal — espere terminar e
        tente de novo. Nada foi parcialmente aplicado.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-brand-strong hover:text-brand-strong"
      >
        Tentar novamente
      </button>
    </div>
  );
}
