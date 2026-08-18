import { cn } from "@/lib/utils/cn";

interface HubDiagramProps {
  title: string;
  center: string;
  centerDetail?: string;
  nodes: string[];
  className?: string;
}

const W = 600;
const H = 480;
const C = { x: 300, y: 240 };
const RX = 196;
const RY = 168;

const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;

/**
 * Diagrama "hub" (PRD §29): um agente/sistema no centro conectado às fontes e ferramentas
 * da empresa. Mesma linguagem do hero — discos do símbolo, órbita com brilho, pacotes de luz
 * fluindo para o centro. SVG + CSS, sem logos de terceiros. Rótulos em HTML (acessíveis).
 */
export function HubDiagram({ title, center, centerDetail, nodes, className }: HubDiagramProps) {
  const positioned = nodes.map((label, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return { label, x: C.x + Math.cos(angle) * RX, y: C.y + Math.sin(angle) * RY };
  });

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
        <g fill="var(--brand-primary)">
          <circle cx={C.x} cy={C.y} r="104" fillOpacity="0.09" />
          <circle cx={C.x + 38} cy={C.y - 28} r="86" fillOpacity="0.11" />
          <circle cx={C.x - 34} cy={C.y + 30} r="82" fillOpacity="0.11" />
        </g>

        <ellipse
          cx={C.x}
          cy={C.y}
          rx={RX}
          ry={RY}
          fill="none"
          stroke="var(--border-strong)"
          strokeOpacity="0.55"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
        <ellipse
          cx={C.x}
          cy={C.y}
          rx={RX}
          ry={RY}
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="6 94"
          strokeOpacity="0.9"
          className="motion-safe:animate-orbit"
          style={{ transformOrigin: `${C.x}px ${C.y}px`, animationDelay: "0.8s" }}
        />
        <circle
          cx={C.x}
          cy={C.y}
          r="66"
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="1.5"
          className="motion-safe:animate-heartbeat"
          style={{ transformOrigin: `${C.x}px ${C.y}px`, animationDelay: "1.2s", animationFillMode: "both" }}
        />

        {positioned.map((n, i) => {
          const d = `M ${n.x.toFixed(1)} ${n.y.toFixed(1)} L ${C.x} ${C.y}`;
          const duration = `${4.8 + (i % 3) * 0.8}s`;
          const delay = `${0.8 + i * 0.4}s`;
          return (
            <g key={n.label}>
              <path
                d={d}
                fill="none"
                stroke="var(--border-strong)"
                strokeOpacity="0.9"
                strokeWidth="1.25"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                className="motion-safe:animate-draw"
                style={{ ["--draw-length" as string]: 100, animationDelay: `${100 + i * 70}ms` }}
              />
              <path
                d={d}
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth="5"
                strokeOpacity="0.28"
                strokeLinecap="round"
                pathLength={120}
                strokeDasharray="10 110"
                className="motion-safe:animate-flow"
                style={{ animationDelay: delay, animationDuration: duration }}
              />
              <path
                d={d}
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth="2.25"
                strokeLinecap="round"
                pathLength={120}
                strokeDasharray="10 110"
                className="motion-safe:animate-flow"
                style={{ animationDelay: delay, animationDuration: duration }}
              />
            </g>
          );
        })}
      </svg>

      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-brand/40 bg-brand px-5 py-3 text-center text-brand-ink shadow-glow motion-safe:animate-rise-in sm:px-6 sm:py-4"
        style={{ left: pct(C.x, W), top: pct(C.y, H) }}
      >
        <span className="font-display text-base font-bold tracking-tight whitespace-nowrap sm:text-h4">{center}</span>
        {centerDetail ? <span className="text-xs font-medium opacity-80">{centerDetail}</span> : null}
      </div>

      {positioned.map((n, i) => (
        <div
          key={n.label}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-foreground shadow-md motion-safe:animate-rise-in sm:px-3.5 sm:text-small"
          style={{ left: pct(n.x, W), top: pct(n.y, H), animationDelay: `${200 + i * 70}ms` }}
        >
          {n.label}
        </div>
      ))}
    </div>
  );
}
