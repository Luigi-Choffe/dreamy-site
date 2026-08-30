"use client";

import { useState } from "react";

export interface BriefingView {
  content: string;
  /** Data/hora já formatada (evita divergência de fuso entre servidor e cliente). */
  label: string;
  model: string;
}

const BTN =
  "rounded-md border border-border bg-background-secondary px-3 py-1.5 text-xs font-semibold text-foreground " +
  "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60";

/** Briefing do dia escrito pelo MORK via IA. Só texto para ler: a IA nunca age sozinha. */
export function BriefingCard({ initial, isDemo }: { initial: BriefingView | null; isDemo: boolean }) {
  const [briefing, setBriefing] = useState<BriefingView | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/outbound/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demo: isDemo }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        briefing?: { content: string; generatedAt: string; model: string; demo?: boolean };
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.briefing) {
        setError(data?.error ?? `O servidor respondeu ${res.status}. Tente de novo.`);
        return;
      }
      const quando = new Date(data.briefing.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      setBriefing({
        content: data.briefing.content,
        label: `${quando}${data.briefing.demo ? " · exemplo" : ""}`,
        model: data.briefing.model,
      });
    } catch {
      setError("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Briefing do MORK" className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Briefing do MORK</h3>
        <button type="button" onClick={gerar} disabled={loading} className={BTN}>
          {loading ? "Gerando…" : briefing ? "Gerar de novo" : "Gerar briefing do dia"}
        </button>
      </div>
      {error ? <p className="mt-3 text-xs font-semibold text-error">{error}</p> : null}
      {briefing ? (
        <>
          <p className="mt-3 text-small whitespace-pre-wrap text-foreground">{briefing.content}</p>
          <p className="mt-2 text-xs text-foreground-subtle">
            {briefing.label} · {briefing.model} · escrito por IA, confira os números no console
          </p>
        </>
      ) : !error ? (
        <p className="mt-3 text-xs text-foreground-subtle">
          Um resumo executivo do dia (números, riscos e a ação mais importante), escrito pelo MORK com IA.
        </p>
      ) : null}
    </section>
  );
}
