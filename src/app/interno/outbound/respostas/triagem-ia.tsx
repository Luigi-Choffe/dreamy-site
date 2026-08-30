"use client";

import { useState } from "react";

const CLASSE_LABELS: Record<string, string> = {
  interested: "interessado",
  not_now: "agora não",
  referral: "indicação",
  negative: "negativa",
  ooo: "fora do escritório",
  other: "outra",
};

const BTN =
  "rounded-md border border-border bg-background-secondary px-2.5 py-1 text-xs font-semibold text-foreground " +
  "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60";
const CONTROL =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground " +
  "hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";

interface Suggestion {
  classe: string;
  resumo: string;
  rascunho: string;
}

/**
 * Sugestão de triagem por IA para UMA resposta. Gate humano sempre: nada é
 * classificado, gravado ou enviado por aqui; o rascunho é para copiar e revisar.
 */
export function TriagemIA({
  replyId,
  contactId,
  textoInicial,
  isDemo,
  replyTo,
}: {
  replyId: string;
  contactId?: string;
  textoInicial?: string;
  isDemo: boolean;
  replyTo?: string | null;
}) {
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [out, setOut] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sugerir() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/outbound/sugestao-resposta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ replyId, contactId, texto, demo: isDemo }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        suggestion?: Suggestion;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.suggestion) {
        setError(data?.error ?? `O servidor respondeu ${res.status}. Tente de novo.`);
        return;
      }
      setOut(data.suggestion);
    } catch {
      setError("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-semibold text-brand-strong">Sugestão de IA</summary>
      <div className="mt-2 flex max-w-xl flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-foreground-subtle">
            cole o texto da resposta (e-mails são removidos antes de ir para a IA)
          </span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className={CONTROL} />
        </label>
        <div>
          <button type="button" onClick={sugerir} disabled={loading || texto.trim().length < 5} className={BTN}>
            {loading ? "Analisando…" : "Sugerir triagem e rascunho"}
          </button>
        </div>
        {error ? <p className="font-semibold text-error">{error}</p> : null}
        {out ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-background-secondary/40 p-2.5">
            <p>
              <span className="font-semibold">classe sugerida:</span> {CLASSE_LABELS[out.classe] ?? out.classe}{" "}
              <span className="text-foreground-subtle">(a classificação continua sendo sua, no seletor da linha)</span>
            </p>
            <p>{out.resumo}</p>
            {out.rascunho ? (
              <textarea
                readOnly
                value={out.rascunho}
                rows={4}
                className={CONTROL}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Rascunho de resposta gerado por IA"
              />
            ) : null}
            <p className="text-foreground-subtle">
              Rascunho de IA: revise e envie você mesmo{replyTo ? ` pela caixa ${replyTo}` : ""}. Nada é enviado nem
              gravado sozinho.
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}
