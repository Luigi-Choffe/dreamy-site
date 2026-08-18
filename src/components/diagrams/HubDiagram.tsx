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
const R = 178;

/**
 * Diagrama "hub": um agente/sistema no centro conectado a fontes/ferramentas ao redor
 * (PRD §29 — integração: CRM, ERP, WhatsApp, e-mail, banco de dados, documentos, APIs).
 * SVG + CSS, sem logos de terceiros. Rótulos em HTML (acessíveis).
 */
export function HubDiagram({ title, center, centerDetail, nodes, className }: HubDiagramProps) {
  const positioned = nodes.map((label, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return { label, x: C.x + Math.cos(angle) * R, y: C.y + Math.sin(angle) * R * 0.86 };
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
        <defs>
          <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C.x} cy={C.y} r="150" fill="url(#hub-glow)" />
        <ellipse cx={C.x} cy={C.y} rx={R} ry={R * 0.86} fill="none" stroke="var(--border)" strokeDasharray="2 6" />
        {positioned.map((n, i) => (
          <g key={n.label}>
            <line
              x1={n.x}
              y1={n.y}
              x2={C.x}
              y2={C.y}
              stroke="var(--border-strong)"
              strokeWidth="1.5"
              pathLength={100}
              strokeDasharray="100"
              className="motion-safe:animate-draw"
              style={{ ["--draw-length" as string]: 100, animationDelay: `${100 + i * 70}ms` }}
            />
            <line
              x1={n.x}
              y1={n.y}
              x2={C.x}
              y2={C.y}
              stroke="var(--brand-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength={120}
              strokeDasharray="8 112"
              className="motion-safe:animate-flow"
              style={{ animationDelay: `${i * -0.9}s`, animationDuration: `${5 + (i % 3)}s` }}
            />
          </g>
        ))}
      </svg>

      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl border border-brand/40 bg-brand px-5 py-3 text-center text-brand-ink shadow-glow motion-safe:animate-rise-in"
        style={{ left: `${(C.x / W) * 100}%`, top: `${(C.y / H) * 100}%` }}
      >
        <span className="font-display text-base font-bold whitespace-nowrap sm:text-h4">{center}</span>
        {centerDetail ? <span className="text-xs font-medium opacity-80">{centerDetail}</span> : null}
      </div>

      {positioned.map((n, i) => (
        <div
          key={n.label}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-foreground shadow-sm motion-safe:animate-rise-in sm:px-3.5 sm:text-small"
          style={{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%`, animationDelay: `${200 + i * 70}ms` }}
        >
          {n.label}
        </div>
      ))}
    </div>
  );
}
