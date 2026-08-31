"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Chat com o MORK na lateral do console: perguntas sobre as ações, os dados e
 * a operação do workspace. SÓ leitura: a IA responde com os números do console
 * e nunca executa nada por aqui (gate humano absoluto). Histórico vive na
 * memória da página (nada é gravado). PII: a rota redige e-mails antes do
 * prompt; aqui nenhum dado sensível é exibido além do que o usuário digitar.
 */

interface ChatMsg {
  papel: "voce" | "mork";
  texto: string;
}

const SUGESTOES = ["Como está o funil hoje?", "O que o time fez esta semana?", "Qual a ação mais importante agora?"];

/** Últimas trocas enviadas como contexto (a rota também limita). */
const HISTORICO_MAX = 6;

export function AquarioChat({ isDemo, alto = false }: { isDemo: boolean; alto?: boolean }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgs.length > 0 || loading) fimRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msgs.length, loading]);

  async function perguntar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || loading) return;
    setError(null);
    setTexto("");
    const historico = msgs.slice(-HISTORICO_MAX);
    setMsgs((prev) => [...prev, { papel: "voce", texto: limpa }]);
    setLoading(true);
    try {
      const res = await fetch("/api/outbound/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demo: isDemo, pergunta: limpa, historico }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        resposta?: string;
        model?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.resposta) {
        setError(data?.error ?? `O servidor respondeu ${res.status}. Tente de novo.`);
        return;
      }
      setModel(data.model ?? null);
      setMsgs((prev) => [...prev, { papel: "mork", texto: data.resposta! }]);
    } catch {
      setError("Não deu para falar com o servidor. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-label="Pergunte ao MORK"
      className={alto ? "p-3" : "rounded-2xl border border-border bg-surface p-3 shadow-sm"}
    >
      <header className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="font-display text-[0.68rem] font-bold tracking-[0.24em] text-foreground-muted uppercase">
          Pergunte ao MORK
        </h2>
        {model ? <p className="text-[0.6rem] text-foreground-subtle">{model}</p> : null}
      </header>

      <div
        aria-live="polite"
        className={`no-scrollbar mt-2 flex min-h-0 flex-col gap-2 overflow-y-auto pr-0.5 ${
          alto ? "max-h-[55dvh] min-h-[16rem]" : "max-h-64"
        }`}
      >
        {msgs.length === 0 && !loading ? (
          <div className="flex flex-col gap-1.5 py-1">
            <p className="text-[0.7rem] leading-snug text-foreground-muted">
              Pergunte sobre o funil, as ações do time, os envios ou o que fazer agora.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => perguntar(s)}
                  className="rounded-full bg-background-secondary px-2.5 py-1 text-[0.68rem] font-semibold text-foreground-muted transition-colors duration-(--duration-fast) hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {msgs.map((m, i) =>
          m.papel === "voce" ? (
            <p
              key={i}
              className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-background-secondary px-3 py-1.5 text-[0.74rem] leading-snug break-words whitespace-pre-wrap text-foreground"
            >
              {m.texto}
            </p>
          ) : (
            <div key={i} className="flex max-w-[92%] items-start gap-1.5 self-start">
              <span
                aria-hidden
                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full font-display text-[0.5rem] font-extrabold text-[#052012]"
                style={{
                  background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
                  boxShadow: "0 0 0 1px rgb(255 255 255 / 0.85)",
                }}
              >
                MK
              </span>
              <p className="min-w-0 rounded-2xl rounded-bl-md border border-border bg-white/70 px-3 py-1.5 text-[0.74rem] leading-snug break-words whitespace-pre-wrap text-foreground">
                {m.texto}
              </p>
            </div>
          ),
        )}

        {loading ? (
          <div className="flex items-center gap-1.5 self-start px-1" aria-label="O MORK está escrevendo">
            <span
              aria-hidden
              className="inline-flex size-5 items-center justify-center rounded-full font-display text-[0.5rem] font-extrabold text-[#052012]"
              style={{ background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)" }}
            >
              MK
            </span>
            <span aria-hidden className="flex gap-1">
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="size-1.5 rounded-full bg-foreground-subtle motion-safe:animate-pulse"
                  style={{ animationDelay: `${k * 180}ms` }}
                />
              ))}
            </span>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-[0.7rem] font-semibold text-error">
            {error}
          </p>
        ) : null}
        <div ref={fimRef} />
      </div>

      <form
        className="mt-2 flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void perguntar(texto);
        }}
      >
        <label htmlFor="mork-chat-pergunta" className="sr-only">
          Pergunta para o MORK
        </label>
        <input
          id="mork-chat-pergunta"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={500}
          placeholder="pergunte ao MORK…"
          className="h-8 w-full min-w-0 rounded-full border border-border bg-surface px-3 text-xs text-foreground placeholder:text-foreground-subtle/80 hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || texto.trim().length === 0}
          className="h-8 shrink-0 rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand-strong transition-colors duration-(--duration-fast) hover:bg-brand-soft-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "…" : "Enviar"}
        </button>
      </form>
      <p className="mt-1.5 px-1 text-[0.6rem] leading-snug text-foreground-subtle">
        Escrito por IA com os dados do console. O MORK não executa nada por aqui; confira os números nas abas.
      </p>
    </section>
  );
}
