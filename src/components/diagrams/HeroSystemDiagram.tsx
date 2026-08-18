import { Cog, Database, Layers, Sparkles, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Visual-assinatura do Hero (PRD §16): "sistema vivo" — a empresa no centro, conectada a
 * clientes, dados, sistemas e operação (entradas) e produzindo IA e receita (saídas).
 *
 * Linguagem: os discos translúcidos do símbolo da Dreamy atrás do núcleo, uma órbita
 * pontilhada com um brilho que percorre o anel, conectores finos com "pacotes" de luz
 * fluindo na direção certa e um pulso lento no núcleo. SVG + CSS puro (sem JS, sem
 * biblioteca); rótulos em HTML real; tudo respeita prefers-reduced-motion.
 */

const W = 640;
const H = 560;
const C = { x: 320, y: 292 };
const RING = 214;

interface Node {
  id: string;
  label: string;
  angle: number; // graus, sentido horário a partir do eixo x (coordenadas SVG)
  flow: "in" | "out";
  icon: LucideIcon;
  accent?: boolean;
}

const NODES: Node[] = [
  { id: "clientes", label: "Clientes", angle: 210, flow: "in", icon: Users },
  { id: "dados", label: "Dados", angle: 270, flow: "in", icon: Database },
  { id: "sistemas", label: "Sistemas", angle: 330, flow: "in", icon: Layers },
  { id: "receita", label: "Receita", angle: 30, flow: "out", icon: TrendingUp, accent: true },
  { id: "ia", label: "IA", angle: 90, flow: "out", icon: Sparkles, accent: true },
  { id: "operacao", label: "Operação", angle: 150, flow: "in", icon: Cog },
];

function position(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: C.x + Math.cos(rad) * RING, y: C.y + Math.sin(rad) * RING };
}

/** Curva suave nó ↔ núcleo, orientada no sentido do fluxo (para o pacote andar na direção certa). */
function connector(node: Node): string {
  const p = position(node.angle);
  const from = node.flow === "in" ? p : C;
  const to = node.flow === "in" ? C : p;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const k = 22;
  const cx = mx + (-dy / len) * k;
  const cy = my + (dx / len) * k;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;

export function HeroSystemDiagram({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn("relative mx-auto w-full max-w-[640px] select-none", className)}
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
          <linearGradient id="hero-packet" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-gradient-from)" stopOpacity="0" />
            <stop offset="60%" stopColor="var(--brand-gradient-from)" />
            <stop offset="100%" stopColor="var(--brand-gradient-to)" />
          </linearGradient>
        </defs>

        {/* discos do símbolo atrás do núcleo (motivo da marca) */}
        <g fill="var(--brand-primary)">
          <circle
            cx={C.x}
            cy={C.y}
            r="118"
            fillOpacity="0.09"
            className="motion-safe:animate-breathe"
            style={{ transformOrigin: `${C.x}px ${C.y}px`, animationDelay: "1.2s", ["--breathe-x" as string]: "4px" }}
          />
          <circle
            cx={C.x + 44}
            cy={C.y - 32}
            r="98"
            fillOpacity="0.11"
            className="motion-safe:animate-breathe"
            style={{
              transformOrigin: `${C.x + 44}px ${C.y - 32}px`,
              animationDelay: "2.4s",
              ["--breathe-x" as string]: "-6px",
              ["--breathe-y" as string]: "4px",
            }}
          />
          <circle
            cx={C.x - 38}
            cy={C.y + 36}
            r="94"
            fillOpacity="0.11"
            className="motion-safe:animate-breathe"
            style={{
              transformOrigin: `${C.x - 38}px ${C.y + 36}px`,
              animationDelay: "3.6s",
              ["--breathe-x" as string]: "5px",
              ["--breathe-y" as string]: "6px",
            }}
          />
        </g>

        {/* órbitas */}
        <circle
          cx={C.x}
          cy={C.y}
          r={RING}
          fill="none"
          stroke="var(--border-strong)"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
        <circle cx={C.x} cy={C.y} r="142" fill="none" stroke="var(--border)" strokeOpacity="0.9" strokeWidth="1" />
        {/* brilho que percorre a órbita externa */}
        <circle
          cx={C.x}
          cy={C.y}
          r={RING}
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="6 94"
          strokeOpacity="0.9"
          className="motion-safe:animate-orbit"
          style={{ transformOrigin: `${C.x}px ${C.y}px`, animationDelay: "1s" }}
        />

        {/* pulso do núcleo */}
        <circle
          cx={C.x}
          cy={C.y}
          r="74"
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="1.5"
          className="motion-safe:animate-heartbeat"
          style={{ transformOrigin: `${C.x}px ${C.y}px`, animationDelay: "1.6s", animationFillMode: "both" }}
        />

        {/* conectores: trilho + pacote de luz (com halo) */}
        {NODES.map((node, i) => {
          const d = connector(node);
          const duration = `${5.2 + (i % 3) * 0.9}s`;
          // começa depois da entrada (protege o LCP) e escalonado entre os conectores
          const delay = `${1.4 + i * 0.45}s`;
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
                style={{ ["--draw-length" as string]: 100, animationDelay: `${360 + i * 80}ms` }}
              />
              <path
                d={d}
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth="5"
                strokeOpacity="0.28"
                strokeLinecap="round"
                pathLength={120}
                strokeDasharray="12 108"
                strokeDashoffset={-4}
                className="motion-safe:animate-flow"
                style={{ animationDelay: delay, animationDuration: duration }}
              />
              <path
                d={d}
                fill="none"
                stroke="url(#hero-packet)"
                strokeWidth="2.25"
                strokeLinecap="round"
                pathLength={120}
                strokeDasharray="12 108"
                className="motion-safe:animate-flow"
                style={{ animationDelay: delay, animationDuration: duration }}
              />
            </g>
          );
        })}
      </svg>

      {/* núcleo */}
      <div
        className={cn(
          "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-border sm:gap-2.5 sm:rounded-2xl",
          "bg-surface px-4 py-3 shadow-[var(--shadow-lg),var(--shadow-glow-soft)] motion-safe:animate-rise-in sm:px-7 sm:py-5",
        )}
        style={{ left: pct(C.x, W), top: pct(C.y, H), animationDelay: "280ms" }}
      >
        <span className="flex flex-col gap-[3px] sm:gap-1" aria-hidden="true">
          <span className="h-1 w-7 rounded-full bg-border-strong sm:h-1.5 sm:w-9" />
          <span className="h-1 w-5 rounded-full bg-brand sm:h-1.5 sm:w-6" />
          <span className="h-1 w-6 rounded-full bg-border-strong sm:h-1.5 sm:w-8" />
        </span>
        <span className="font-display text-[0.8125rem] font-bold tracking-tight whitespace-nowrap text-foreground sm:text-base">
          Sua empresa
        </span>
      </div>

      {/* nós satélites */}
      {NODES.map((node, i) => {
        const p = position(node.angle);
        const Icon = node.icon;
        return (
          <div
            key={node.id}
            className={cn(
              "absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border py-0.5 pr-2.5 pl-0.5 shadow-md",
              "text-[0.6875rem] font-semibold whitespace-nowrap motion-safe:animate-rise-in sm:gap-2 sm:py-1.5 sm:pr-3.5 sm:pl-1.5 sm:text-small",
              node.accent
                ? "border-brand bg-brand text-brand-ink shadow-glow-soft"
                : "border-border bg-surface text-foreground",
            )}
            style={{ left: pct(p.x, W), top: pct(p.y, H), animationDelay: `${420 + i * 80}ms` }}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full sm:size-7",
                node.accent ? "bg-brand-ink/10 text-brand-ink" : "bg-brand-soft text-brand-strong",
              )}
            >
              <Icon className="size-3 sm:size-4" strokeWidth={2.25} />
            </span>
            {node.label}
          </div>
        );
      })}
    </div>
  );
}
