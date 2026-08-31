"use client";

import { useEffect, useRef } from "react";

/**
 * Camada viva do Aquário: canvas 2D desenhando a rede neural do time,
 * flutuando direto sobre o fundo CLARO da página (v3: sem tanque e sem
 * composição aditiva — toda a luz é o verde do logo Dreamy com alfa).
 * Folha de cliente isolada (regra da casa e da skill de design): rAF com
 * cleanup estrito, DPR limitado, ResizeObserver, e prefers-reduced-motion
 * vira UM quadro estático (sinapses sem pulsos).
 *
 * Motivação de cada movimento (nada é enfeite gratuito):
 * - pulso viajando numa sinapse = fluxo de trabalho MORK ↔ agente (forte e
 *   frequente só quando há demanda REAL em andamento);
 * - halo respirando num nó = agente trabalhando agora;
 * - poeira de luz ao fundo = ambiente (único elemento puramente cênico,
 *   lento e quase imperceptível de propósito).
 */

export interface RedeNode {
  slug: string;
  /** % do palco. */
  x: number;
  y: number;
  hired: boolean;
  live: boolean;
  big?: boolean;
}

export interface RedeLink {
  from: string;
  to: string;
  kind: "comando" | "colaboracao" | "vaga";
  active: boolean;
}

interface Pt {
  x: number;
  y: number;
}

/** Plâncton determinístico (posições fixas; nada de Math.random no render). */
const PLANKTON: Array<{ x: number; y: number; r: number; vx: number; vy: number }> = [
  { x: 8, y: 90, r: 1.6, vx: 0.004, vy: -0.011 },
  { x: 22, y: 70, r: 1.1, vx: -0.003, vy: -0.008 },
  { x: 38, y: 95, r: 2.0, vx: 0.002, vy: -0.014 },
  { x: 55, y: 60, r: 1.2, vx: 0.005, vy: -0.007 },
  { x: 66, y: 88, r: 1.5, vx: -0.004, vy: -0.01 },
  { x: 82, y: 75, r: 1.0, vx: 0.003, vy: -0.009 },
  { x: 90, y: 55, r: 1.4, vx: -0.002, vy: -0.012 },
  { x: 15, y: 40, r: 0.9, vx: 0.002, vy: -0.006 },
  { x: 74, y: 25, r: 1.0, vx: -0.003, vy: -0.007 },
  { x: 44, y: 35, r: 0.8, vx: 0.004, vy: -0.005 },
];

/** Verde do logo Dreamy (--brand-primary #46eb7e) — a única cor da rede. */
const GREEN = (alpha: number) => `rgba(70, 235, 126, ${alpha})`;

function quadPoint(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

export function AquarioRede({ nodes, links }: { nodes: RedeNode[]; links: RedeLink[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const byId = new Map(nodes.map((n) => [n.slug, n]));
    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    observer.observe(canvas);

    const P = (slug: string): Pt => {
      const n = byId.get(slug);
      return n ? { x: (n.x / 100) * w, y: (n.y / 100) * h } : { x: 0, y: 0 };
    };

    /** Curva orgânica: barriga perpendicular fixa por índice + balanço lento. */
    const ctrlPoint = (a: Pt, b: Pt, i: number, time: number): Pt => {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const bulge = (i % 2 === 0 ? 1 : -1) * 0.2 + 0.05 * Math.sin(time * 0.0006 + i * 1.7);
      return { x: mx + (-dy / len) * len * bulge, y: my + (dx / len) * len * bulge };
    };

    interface Pulse {
      linkIndex: number;
      t: number;
      speed: number;
    }
    const pulses: Pulse[] = [];
    links.forEach((link, i) => {
      const count = link.kind === "vaga" ? 0 : link.active ? 3 : 1;
      for (let k = 0; k < count; k += 1) {
        pulses.push({ linkIndex: i, t: (i * 0.19 + k / Math.max(count, 1)) % 1, speed: link.active ? 0.004 : 0.0011 });
      }
    });
    const plankton = PLANKTON.map((p) => ({ ...p }));

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);

      // Plâncton (cenário, quase parado).
      for (const p of plankton) {
        if (!reduce) {
          p.x = (p.x + p.vx + 100) % 100;
          p.y = (p.y + p.vy + 100) % 100;
        }
        ctx.beginPath();
        ctx.arc((p.x / 100) * w, (p.y / 100) * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = GREEN(0.35);
        ctx.fill();
      }

      // Sinapses.
      links.forEach((link, i) => {
        const a = P(link.from);
        const b = P(link.to);
        const c = ctrlPoint(a, b, i, time);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
        if (link.kind === "vaga") {
          ctx.setLineDash([3, 6]);
          ctx.strokeStyle = GREEN(0.4);
          ctx.lineWidth = 1;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = GREEN(link.active ? 0.9 : 0.5);
          ctx.lineWidth = link.active ? 1.6 : 1.1;
        }
        if (link.active) {
          // Brilho só onde há trabalho real: a sinapse ativa emite luz.
          ctx.shadowColor = GREEN(0.5);
          ctx.shadowBlur = 6;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
      });

      // Pulsos viajando (só fora do modo reduzido).
      if (!reduce) {
        for (const pulse of pulses) {
          const link = links[pulse.linkIndex];
          if (!link) continue;
          pulse.t += pulse.speed;
          if (pulse.t > 1) pulse.t -= 1;
          const a = P(link.from);
          const b = P(link.to);
          const c = ctrlPoint(a, b, pulse.linkIndex, time);
          const q = quadPoint(a, c, b, pulse.t);
          const r = link.active ? 3 : 1.6;
          const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 4);
          glow.addColorStop(0, GREEN(link.active ? 0.95 : 0.4));
          glow.addColorStop(1, GREEN(0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Halos dos nós (respiram quando o agente está trabalhando).
      for (const n of nodes) {
        if (!n.hired) continue;
        const p = P(n.slug);
        const base = n.big ? 26 : 20;
        const breath = n.live && !reduce ? 3 + 3 * Math.sin(time * 0.0025 + p.x) : 0;
        const radius = (base + breath) * 1.9;
        const halo = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, radius);
        halo.addColorStop(0, GREEN(n.live ? 0.22 : 0.08));
        halo.addColorStop(1, GREEN(0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let raf = 0;
    const loop = (ts: number) => {
      draw(ts);
      raf = requestAnimationFrame(loop);
    };
    if (reduce) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [nodes, links]);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
