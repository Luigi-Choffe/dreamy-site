import { cn } from "@/lib/utils/cn";

interface AmbientDiscsProps {
  className?: string;
  /** Intensidade (alpha máximo dos discos). */
  intensity?: "soft" | "medium" | "strong";
  /** Respiração lenta (só com motion-safe). */
  animate?: boolean;
}

const alphas = {
  soft: [0.06, 0.07, 0.08],
  medium: [0.09, 0.1, 0.11],
  strong: [0.14, 0.16, 0.18],
} as const;

/**
 * Motivo ambiente derivado do símbolo da Dreamy: três discos translúcidos sobrepostos
 * (as "pétalas" do logo). Sem blur — as bordas nítidas e as sobreposições mais densas
 * são o que remete à marca. Puramente decorativo (aria-hidden), SVG leve, sem JS.
 */
export function AmbientDiscs({ className, intensity = "soft", animate = true }: AmbientDiscsProps) {
  const [a1, a2, a3] = alphas[intensity];
  const anim = animate ? "motion-safe:animate-breathe" : "";
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 400 400"
      className={cn("pointer-events-none absolute select-none", className)}
    >
      <g fill="var(--brand-primary)">
        <circle
          cx="200"
          cy="200"
          r="150"
          fillOpacity={a1}
          className={anim}
          style={{
            transformOrigin: "200px 200px",
            ["--breathe-x" as string]: "6px",
            ["--breathe-y" as string]: "-4px",
          }}
        />
        <circle
          cx="262"
          cy="150"
          r="122"
          fillOpacity={a2}
          className={anim}
          style={{
            transformOrigin: "262px 150px",
            animationDelay: "-3s",
            ["--breathe-x" as string]: "-8px",
            ["--breathe-y" as string]: "6px",
          }}
        />
        <circle
          cx="150"
          cy="258"
          r="112"
          fillOpacity={a3}
          className={anim}
          style={{
            transformOrigin: "150px 258px",
            animationDelay: "-6s",
            ["--breathe-x" as string]: "5px",
            ["--breathe-y" as string]: "8px",
          }}
        />
      </g>
    </svg>
  );
}
