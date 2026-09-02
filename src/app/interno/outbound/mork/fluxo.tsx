"use client";

import { Database, Zap } from "lucide-react";
import { LazyMotion, domAnimation, m, useInView, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * O NÚCLEO (aba MORK): o motor de inteligência do projeto como UMA máquina só.
 * Fim das três ilhas: um único vaso de vidro contém entrada → cérebro → ações;
 * as ARTÉRIAS são caminhos contínuos desenhados de ponta a ponta ATRÁS do
 * conteúdo (emergem de sob o painel, mergulham sob a lente — conexão de
 * verdade, não fiapo no vão), e a luz do núcleo irradia do centro. Painéis
 * internos são superfícies do próprio vaso, não cartões soltos. Números REAIS,
 * contadores com mola, tudo motion-safe. Sem PII: só agregados.
 */

const fmtInt = new Intl.NumberFormat("pt-BR").format;

const FLUXO_CSS = `
.fluxo-arteria {
  stroke: rgb(70 235 126 / 0.5);
  stroke-width: 2;
  stroke-dasharray: 6 10;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.fluxo-arteria-brilho {
  stroke: rgb(70 235 126 / 0.14);
  stroke-width: 8;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes fluxo-dash { to { stroke-dashoffset: -32; } }
  .fluxo-arteria, .fluxo-duto { animation: fluxo-dash 1.8s linear infinite; }
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

/** No empilhado (abaixo de lg) o fluxo continua legível — seta vertical discreta. */
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

/**
 * Painel interno do vaso: superfície da própria máquina (não um cartão solto),
 * com o rótulo da zona DENTRO, ícone e contadores de mola.
 */
function PainelDoNucleo({
  zona,
  icone,
  titulo,
  legenda,
  linhas,
  lado,
}: {
  zona: string;
  icone: ReactNode;
  titulo: string;
  legenda: string;
  linhas: Array<{ label: string; valor: number }>;
  lado: "esquerda" | "direita";
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 120, damping: 20, delay: lado === "esquerda" ? 0 : 0.12 }}
      className="relative w-full rounded-2xl bg-white/65 p-5 shadow-[0_14px_34px_-20px_rgb(11_11_12/0.4)] backdrop-blur-sm"
    >
      <p className="text-[0.58rem] font-bold tracking-[0.26em] text-brand-strong uppercase">{zona}</p>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[#052012]"
          style={{
            background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
            boxShadow: "0 0 12px rgb(70 235 126 / 0.3)",
          }}
        >
          {icone}
        </span>
        <h3 className="font-display text-sm font-bold text-foreground">{titulo}</h3>
      </div>
      <dl className="mt-4 flex flex-col divide-y divide-[rgb(11_11_12/0.05)]">
        {linhas.map((linha) => (
          <div key={linha.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-[0.74rem] text-foreground-muted">{linha.label}</dt>
            <dd className="font-display text-lg font-bold text-foreground tabular-nums">
              <Contador valor={linha.valor} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-[rgb(11_11_12/0.06)] pt-2.5 text-[0.68rem] leading-snug text-foreground-subtle">
        {legenda}
      </p>
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
  /** A lente do Aquário (server component), o cérebro no centro do núcleo. */
  children: ReactNode;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <style>{FLUXO_CSS}</style>
      {/* O VASO: um vidro só para a máquina inteira — nada de ilhas. */}
      <div className="aqua-glass relative overflow-hidden rounded-3xl p-5 lg:p-7">
        {/* A luz do núcleo: irradia do cérebro e respinga nas pontas. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(42% 55% at 50% 42%, rgb(70 235 126 / 0.13), transparent 70%), radial-gradient(28% 36% at 10% 85%, rgb(70 235 126 / 0.05), transparent 75%), radial-gradient(28% 36% at 90% 85%, rgb(70 235 126 / 0.05), transparent 75%)",
          }}
        />
        {/* As ARTÉRIAS: contínuas de ponta a ponta, atrás do conteúdo — emergem
            de sob os painéis e mergulham sob a lente. */}
        <svg
          aria-hidden
          focusable="false"
          className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
          viewBox="0 0 1000 420"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d="M 130 215 C 260 150, 330 275, 480 208" className="fluxo-arteria-brilho" />
          <path d="M 130 215 C 260 150, 330 275, 480 208" className="fluxo-arteria" />
          <path d="M 520 208 C 670 148, 740 278, 870 215" className="fluxo-arteria-brilho" />
          <path d="M 520 208 C 670 148, 740 278, 870 215" className="fluxo-arteria" />
          <circle cx="480" cy="208" r="3.5" fill="rgb(70 235 126 / 0.6)" />
          <circle cx="520" cy="208" r="3.5" fill="rgb(70 235 126 / 0.6)" />
        </svg>

        <div className="relative grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(14rem,1fr)_minmax(0,auto)_minmax(14rem,1fr)] lg:gap-6">
          <PainelDoNucleo
            zona="Entrada de dados"
            lado="esquerda"
            icone={<Database className="size-4.5" aria-hidden />}
            titulo="O que alimenta o time"
            legenda="Leads do Clay, planilhas importadas e a caixa de respostas."
            linhas={[
              { label: "Contatos na base", valor: entrada.contatos },
              { label: "Respostas recebidas", valor: entrada.respostas },
            ]}
          />
          <DutoVertical />
          <div className="flex flex-col items-center">
            <p className="text-[0.58rem] font-bold tracking-[0.26em] text-brand-strong uppercase">Raciocínio</p>
            <div className="mt-2">{children}</div>
          </div>
          <DutoVertical />
          <PainelDoNucleo
            zona="Ações automatizadas"
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
