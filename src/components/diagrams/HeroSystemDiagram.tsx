import { cn } from "@/lib/utils/cn";

/**
 * Visual próprio do Hero (PRD §16): a empresa no centro conectada a clientes, dados,
 * sistemas, operação, IA e receita. SVG + CSS puro (sem JS): linhas desenham na entrada,
 * fluxo animado lento entre nós, nós entram em stagger. Respeita prefers-reduced-motion.
 * Os rótulos são HTML real (acessíveis e legíveis em qualquer viewport).
 */

const W = 600;
const H = 520;
const CENTER = { x: 300, y: 260 };

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  /** direção do fluxo: "in" (nó → empresa) | "out" (empresa → nó) */
  flow: "in" | "out";
  accent?: boolean;
}

const NODES: Node[] = [
  { id: "clientes", label: "Clientes", x: 112, y: 118, flow: "in" },
  { id: "dados", label: "Dados", x: 300, y: 56, flow: "in" },
  { id: "sistemas", label: "Sistemas", x: 488, y: 118, flow: "in" },
  { id: "receita", label: "Receita", x: 488, y: 402, flow: "out", accent: true },
  { id: "ia", label: "IA", x: 300, y: 464, flow: "out", accent: true },
  { id: "operacao", label: "Operação", x: 112, y: 402, flow: "in" },
];

function connector(node: Node): string {
  const from = node.flow === "in" ? node : CENTER;
  const to = node.flow === "in" ? CENTER : node;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  // controle perpendicular suave para curvatura elegante
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const k = 26;
  const cx = mx + (-dy / len) * k;
  const cy = my + (dx / len) * k;
  return `M ${from.x} ${from.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x} ${to.y}`;
}

export function HeroSystemDiagram({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn("relative mx-auto w-full max-w-[600px] select-none", className)}
      style={{ aspectRatio: `${W} / ${H}` }}
      role="img"
      aria-label={title}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.32" />
            <stop offset="55%" stopColor="var(--brand-primary)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hero-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-gradient-from)" />
            <stop offset="100%" stopColor="var(--brand-gradient-to)" />
          </linearGradient>
        </defs>

        {/* glow central */}
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r="190"
          fill="url(#hero-glow)"
          className="motion-safe:animate-pulse-soft"
          style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
        />

        {/* anel de estrutura */}
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r="206"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />

        {/* conectores: base + fluxo animado */}
        {NODES.map((node, i) => {
          const d = connector(node);
          return (
            <g key={node.id}>
              <path
                d={d}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                className="motion-safe:animate-draw"
                style={{ ["--draw-length" as string]: 100, animationDelay: `${120 + i * 90}ms` }}
              />
              <path
                d={d}
                fill="none"
                stroke="url(#hero-flow)"
                strokeWidth="2.5"
                strokeLinecap="round"
                pathLength={120}
                strokeDasharray="10 110"
                className="motion-safe:animate-flow"
                style={{ animationDelay: `${i * -1.1}s`, animationDuration: `${6 + (i % 3)}s` }}
              />
            </g>
          );
        })}

        {/* pontos de conexão nos nós */}
        {NODES.map((node, i) => (
          <circle
            key={`dot-${node.id}`}
            cx={node.x}
            cy={node.y}
            r="4"
            fill={node.accent ? "var(--brand-primary)" : "var(--surface)"}
            stroke={node.accent ? "var(--brand-primary)" : "var(--border-strong)"}
            strokeWidth="1.5"
            className="motion-safe:animate-fade-in"
            style={{ animationDelay: `${300 + i * 90}ms` }}
          />
        ))}
      </svg>

      {/* nó central */}
      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-border bg-surface px-5 py-4 shadow-lg motion-safe:animate-rise-in"
        style={{ left: `${(CENTER.x / W) * 100}%`, top: `${(CENTER.y / H) * 100}%`, animationDelay: "80ms" }}
      >
        <span className="grid grid-cols-3 gap-1" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={cn("h-1.5 w-4 rounded-full", n === 4 ? "bg-brand" : "bg-border-strong")} />
          ))}
        </span>
        <span className="font-display text-[0.9375rem] font-bold whitespace-nowrap text-foreground sm:text-base">
          Sua empresa
        </span>
      </div>

      {/* nós satélites */}
      {NODES.map((node, i) => (
        <div
          key={node.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-sm motion-safe:animate-rise-in sm:px-3.5 sm:text-small",
            node.accent ? "border-brand/50 bg-brand text-brand-ink" : "border-border bg-surface text-foreground",
          )}
          style={{ left: `${(node.x / W) * 100}%`, top: `${(node.y / H) * 100}%`, animationDelay: `${260 + i * 90}ms` }}
        >
          {node.label}
        </div>
      ))}
    </div>
  );
}
