"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export interface BriefingView {
  content: string;
  /** Data/hora já formatada (evita divergência de fuso entre servidor e cliente). */
  label: string;
  model: string;
}

/**
 * Briefing do dia escrito pelo MORK via IA. Só texto para ler: a IA nunca age
 * sozinha. É o momento de assinatura do produto, por isso o monograma do MORK
 * (o mesmo do Aquário) e o esqueleto animado enquanto a IA escreve.
 */
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
    <section
      aria-label="Briefing do MORK"
      className="surface-sheen relative rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full font-display text-[0.66rem] font-extrabold text-[#052012]"
            style={{
              background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
              boxShadow: "0 0 0 1px rgb(255 255 255 / 0.85), 0 6px 14px -6px rgb(15 124 71 / 0.45)",
            }}
          >
            MK
          </span>
          <h3 className="text-xs font-semibold tracking-wide text-foreground-subtle uppercase">Briefing do MORK</h3>
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-8 px-3.5 py-1 text-xs"
          loading={loading}
          loadingLabel="Gerando o briefing"
          onClick={gerar}
        >
          {briefing ? "Gerar de novo" : "Gerar briefing do dia"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-semibold text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div aria-hidden className="mt-4 flex flex-col gap-2.5">
          {[92, 100, 74].map((w) => (
            <span
              key={w}
              className="h-3 rounded-full bg-background-secondary motion-safe:animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : briefing ? (
        <div className="motion-safe:animate-fade-in">
          <p className="mt-3 text-small whitespace-pre-wrap text-foreground">{briefing.content}</p>
          <p className="mt-2 text-xs text-foreground-subtle">
            {briefing.label} · {briefing.model} · escrito por IA, confira os números no console
          </p>
        </div>
      ) : !error ? (
        <p className="mt-3 text-xs text-foreground-subtle">
          Um resumo executivo do dia (números, riscos e a ação mais importante), escrito pelo MORK com IA.
        </p>
      ) : null}
    </section>
  );
}
