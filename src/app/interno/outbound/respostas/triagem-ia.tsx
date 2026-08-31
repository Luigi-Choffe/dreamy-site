"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { classifyReplyAction } from "../actions";

const CLASSE_LABELS: Record<string, string> = {
  interested: "interessado",
  not_now: "agora não",
  referral: "indicação",
  negative: "negativa",
  ooo: "fora do escritório",
  other: "outra",
};

const BTN =
  "rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong " +
  "transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-brand-soft-strong " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-60";
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
  const [copied, setCopied] = useState(false);
  const [applying, startApplying] = useTransition();
  const { toast } = useToast();

  /** Um clique aplica a classe sugerida (o seletor da linha segue como override). */
  function aplicarClasse(classe: string) {
    startApplying(async () => {
      const fd = new FormData();
      fd.set("replyId", replyId);
      fd.set("classification", classe);
      if (isDemo) fd.set("demo", "1");
      try {
        await classifyReplyAction(fd);
        toast({ variant: "success", title: `Classe "${CLASSE_LABELS[classe] ?? classe}" aplicada.` });
      } catch {
        toast({
          variant: "error",
          title: "Não deu para aplicar a classe.",
          description: "Use o seletor da linha ou tente de novo em instantes.",
        });
      }
    });
  }

  async function copiarRascunho(rascunho: string) {
    try {
      await navigator.clipboard.writeText(rascunho);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "error", title: "Não deu para copiar. Selecione o texto e copie manualmente." });
    }
  }

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
      <summary className="cursor-pointer font-semibold text-foreground-muted transition-colors duration-(--duration-fast) hover:text-foreground">
        Sugestão de IA
      </summary>
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
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => aplicarClasse(out.classe)} disabled={applying} className={BTN}>
                {applying ? "Aplicando…" : "Aplicar classe sugerida"}
              </button>
              {out.rascunho ? (
                <button
                  type="button"
                  onClick={() => copiarRascunho(out.rascunho)}
                  className="rounded-full px-2.5 py-1 font-semibold text-foreground-muted transition-colors duration-(--duration-fast) hover:bg-background-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {copied ? "Copiado" : "Copiar rascunho"}
                </button>
              ) : null}
            </div>
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
