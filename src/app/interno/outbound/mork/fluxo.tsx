"use client";

import { Database, Zap } from "lucide-react";
import { LazyMotion, domAnimation, m, useInView, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * O PALCO da aba MORK (docs/AQUARIO-VIVO.md, P3): a tradução do diagrama de
 * referência do Luigi — Entrada de dados → Raciocínio → Ações automatizadas —
 * com números REAIS do workspace. A lente do Aquário (server component) entra
 * como children no centro; os cartões de vidro nas laterais contam de zero com
 * mola (Motion) quando entram na tela; os dutos entre as colunas têm fluxo
 * animado indicando a direção do trabalho. Sem PII: só agregados.
 */

const fmtInt = new Intl.NumberFormat("pt-BR").format;

const FLUXO_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes fluxo-dash { to { stroke-dashoffset: -24; } }
  .fluxo-duto { animation: fluxo-dash 1.4s linear infinite; }
}
`;

/** Número que conta de zero com mola quando entra na viewport. */
function Contador({ valor }: { valor: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const spring = useSpring(0, { stiffness: 80, damping: 22 });
  const texto = useTransform(spring, (v) => fmtInt(Math.round(v)));

  useEffect(() => {
    if (inView) spring.set(valor);
  }, [inView, valor, spring]);

  if (reduce) return <span ref={ref}>{fmtInt(valor)}</span>;
  return (
    <span ref={ref}>
      <m.span>{texto}</m.span>
    </span>
  );
}

/** Duto entre colunas: curva de vidro com tracejado fluindo na direção do trabalho. */
function Duto() {
  return (
    <svg viewBox="0 0 100 48" className="hidden h-12 w-full self-center lg:block" aria-hidden focusable="false">
      <path
        d="M0 24 C 30 10, 70 38, 100 24"
        fill="none"
        stroke="rgb(70 235 126 / 0.5)"
        strokeWidth="1.6"
        strokeDasharray="4 8"
        strokeLinecap="round"
        className="fluxo-duto"
      />
      <circle cx="3" cy="23.5" r="2.4" fill="rgb(70 235 126 / 0.7)" />
      <circle cx="97" cy="23.5" r="2.4" fill="rgb(70 235 126 / 0.7)" />
    </svg>
  );
}

/** R13: no empilhado (abaixo de lg) o fluxo continua legível — seta vertical discreta. */
function DutoVertical() {
  return (
    <svg viewBox="0 0 24 40" className="mx-auto h-10 w-6 lg:hidden" aria-hidden focusable="false">
      <path
        d="M12 2 v26"
        fill="none"
        stroke="rgb(70 235 126 / 0.5)"
        strokeWidth="1.6"
        strokeDasharray="4 8"
        strokeLinecap="round"
        className="fluxo-duto"
      />
      <path
        d="M7 30 l5 6 5 -6"
        fill="none"
        stroke="rgb(70 235 126 / 0.7)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Etapa({ children }: { children: ReactNode }) {
  return (
    <p className="text-center font-display text-[0.62rem] font-bold tracking-[0.26em] text-foreground-subtle uppercase">
      {children}
    </p>
  );
}

function CartaoFluxo({
  icone,
  titulo,
  legenda,
  linhas,
  lado,
}: {
  icone: ReactNode;
  titulo: string;
  legenda: string;
  linhas: Array<{ label: string; valor: number }>;
  lado: "esquerda" | "direita";
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 120, damping: 20, delay: lado === "esquerda" ? 0 : 0.12 }}
      className="aqua-glass w-full rounded-3xl p-5"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[#052012]"
          style={{ background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)" }}
        >
          {icone}
        </span>
        <h3 className="font-display text-sm font-bold text-foreground">{titulo}</h3>
      </div>
      <dl className="mt-4 flex flex-col divide-y divide-border">
        {linhas.map((linha) => (
          <div key={linha.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-[0.74rem] text-foreground-muted">{linha.label}</dt>
            <dd className="font-display text-lg font-bold text-foreground tabular-nums">
              <Contador valor={linha.valor} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-border pt-2.5 text-[0.68rem] leading-snug text-foreground-subtle">{legenda}</p>
    </m.div>
  );
}

export function FluxoDoAgente({
  entrada,
  acoes,
  children,
}: {
  entrada: { contatos: number; respostas: number };
  acoes: { enviados: number; reunioes: number; tarefas: number };
  /** A lente do Aquário (server component), o raciocínio no centro do fluxo. */
  children: ReactNode;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <style>{FLUXO_CSS}</style>
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(14rem,1fr)_minmax(3rem,5rem)_auto_minmax(3rem,5rem)_minmax(14rem,1fr)] lg:gap-2">
        <div className="flex flex-col gap-2.5">
          <Etapa>Entrada de dados</Etapa>
          <CartaoFluxo
            lado="esquerda"
            icone={<Database className="size-4.5" aria-hidden />}
            titulo="O que alimenta o time"
            legenda="Leads do Clay, planilhas importadas e a caixa de respostas."
            linhas={[
              { label: "Contatos na base", valor: entrada.contatos },
              { label: "Respostas recebidas", valor: entrada.respostas },
            ]}
          />
        </div>
        <Duto />
        <DutoVertical />
        <div className="flex flex-col items-center gap-2.5">
          <Etapa>Raciocínio</Etapa>
          {children}
        </div>
        <Duto />
        <DutoVertical />
        <div className="flex flex-col gap-2.5">
          <Etapa>Ações automatizadas</Etapa>
          <CartaoFluxo
            lado="direita"
            icone={<Zap className="size-4.5" aria-hidden />}
            titulo="O que o time produz"
            legenda="Disparos na voz do Luigi, follow-ups e agenda; nada sai sem gate humano."
            linhas={[
              { label: "E-mails enviados", valor: acoes.enviados },
              { label: "Reuniões na agenda", valor: acoes.reunioes },
              { label: "Tarefas concluídas", valor: acoes.tarefas },
            ]}
          />
        </div>
      </div>
    </LazyMotion>
  );
}
