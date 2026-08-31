"use client";

import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Camada viva do Aquário v4: canvas 2D com a rede neural do time + o MOTOR DE
 * CONVERSAS (docs/AQUARIO-VIVO.md). A cada ~10s dois agentes conectados
 * conversam: partículas com rastro viajam pela sinapse nos dois sentidos e
 * balões de vidro (Motion, molas de verdade) mostram micro-falas VERDADEIRAS —
 * o último registro do ator ou a vigília fiel da cadeira. Regra de honestidade
 * intacta: luz FORTE continua exclusiva de trabalho real (link ativo); a
 * conversa ambiente é suave e nunca inventa entrega.
 *
 * Toda a camada é decorativa (aria-hidden): a informação acessível segue nas
 * fichas e nos nós HTML. rAF pausa com aba oculta e fora da viewport;
 * prefers-reduced-motion vira UM quadro estático, sem conversas.
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

interface Bolha {
  key: number;
  slug: string;
  texto: string;
  x: number;
  y: number;
  /** Nós no topo do palco (MORK) falam para baixo. */
  abaixo: boolean;
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

/** Ritmo da conversa ambiente (ms). */
const CONVERSA_DUR = 6400;
const CONVERSA_PAUSA_MIN = 8000;
const CONVERSA_PAUSA_VAR = 6000;
const PRIMEIRA_CONVERSA = 2600;

function quadPoint(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

export function AquarioRede({
  nodes,
  links,
  falas,
}: {
  nodes: RedeNode[];
  links: RedeLink[];
  /** Pool de micro-falas verdadeiras por cadeira (seatFalas). */
  falas?: Record<string, string[]>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bolhas, setBolhas] = useState<Bolha[]>([]);

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

    /* ── Motor de conversas ────────────────────────────────────────────── */
    // Só pares contratados conversam; a vaga (MIRA) fica em silêncio.
    const conversaveis = links
      .map((link, i) => ({ link, i }))
      .filter(({ link }) => link.kind !== "vaga" && byId.get(link.from)?.hired && byId.get(link.to)?.hired);
    let conv: { linkIndex: number; start: number; meiaVolta: boolean } | null = null;
    let proximaConversaEm = PRIMEIRA_CONVERSA;
    let ultimaConversa = -1;
    const falaCursor = new Map<string, number>();
    let bolhaKey = 0;

    const falaDe = (slug: string): string => {
      const pool = falas?.[slug] ?? [];
      if (pool.length === 0) return "…";
      const at = falaCursor.get(slug) ?? 0;
      falaCursor.set(slug, at + 1);
      return pool[at % pool.length] as string;
    };

    const bolhaDe = (slug: string): Bolha => {
      const n = byId.get(slug);
      return {
        key: (bolhaKey += 1),
        slug,
        texto: falaDe(slug),
        x: Math.min(80, Math.max(20, n?.x ?? 50)),
        y: n?.y ?? 50,
        abaixo: (n?.y ?? 50) < 26,
      };
    };

    const passoConversa = (time: number) => {
      if (conversaveis.length === 0) return;
      if (!conv) {
        if (time >= proximaConversaEm) {
          // Sorteio simples, evitando repetir o mesmo par duas vezes seguidas.
          let pick = conversaveis[Math.floor(Math.random() * conversaveis.length)]!;
          if (conversaveis.length > 1 && pick.i === ultimaConversa) {
            pick = conversaveis[(conversaveis.findIndex((c) => c.i === pick.i) + 1) % conversaveis.length]!;
          }
          conv = { linkIndex: pick.i, start: time, meiaVolta: false };
          ultimaConversa = pick.i;
          setBolhas([bolhaDe(pick.link.from)]);
        }
        return;
      }
      const p = (time - conv.start) / CONVERSA_DUR;
      const link = links[conv.linkIndex];
      if (p >= 1 || !link) {
        conv = null;
        proximaConversaEm = time + CONVERSA_PAUSA_MIN + Math.random() * CONVERSA_PAUSA_VAR;
        setBolhas([]);
        return;
      }
      if (p >= 0.48 && !conv.meiaVolta) {
        conv.meiaVolta = true;
        const resposta = bolhaDe(link.to);
        setBolhas((prev) => [...prev.slice(-1), resposta]);
      }
    };

    /** Partículas da conversa: 3 mensageiras com rastro, ida e depois volta. */
    const drawConversa = (time: number) => {
      if (!conv) return;
      const link = links[conv.linkIndex];
      if (!link) return;
      const p = (time - conv.start) / CONVERSA_DUR;
      const a = P(link.from);
      const b = P(link.to);
      const c = ctrlPoint(a, b, conv.linkIndex, time);

      // A sinapse da conversa acende suave (bem abaixo do brilho de trabalho real).
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      ctx.strokeStyle = GREEN(0.75);
      ctx.lineWidth = 1.4;
      ctx.shadowColor = GREEN(0.35);
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const ida = p < 0.5;
      const local = ida ? p / 0.5 : (p - 0.5) / 0.5;
      for (let i = 0; i < 3; i += 1) {
        const head = Math.min(1, Math.max(0, local * 1.3 - i * 0.14));
        for (let k = 0; k < 5; k += 1) {
          const tt = head - k * 0.04;
          if (tt <= 0 || tt >= 1) continue;
          const q = quadPoint(a, c, b, ida ? tt : 1 - tt);
          const fade = Math.sin(Math.PI * tt) * (1 - k * 0.18);
          const r = (2.6 - k * 0.4) * (i === 0 ? 1 : 0.8);
          const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3);
          glow.addColorStop(0, GREEN(0.85 * fade));
          glow.addColorStop(1, GREEN(0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

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
        passoConversa(time);
        drawConversa(time);
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

    /* Pausa honesta: aba oculta ou palco fora da viewport param o motor. */
    let raf = 0;
    let running = false;
    const visivel = { pagina: !document.hidden, viewport: true };
    const loop = (ts: number) => {
      draw(ts);
      raf = requestAnimationFrame(loop);
    };
    const rega = () => {
      const deve = !reduce && visivel.pagina && visivel.viewport;
      if (deve && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!deve && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    const onVisibility = () => {
      visivel.pagina = !document.hidden;
      rega();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const io = new IntersectionObserver(([entry]) => {
      visivel.viewport = entry?.isIntersecting ?? true;
      rega();
    });
    io.observe(canvas);

    if (reduce) {
      draw(0);
    } else {
      rega();
    }
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [nodes, links, falas]);

  return (
    <>
      <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />
      {/* Balões da conversa: decorativos (a informação acessível está nas fichas). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {bolhas.map((b) => (
              <span key={b.key} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
                {/* Nós do topo (MORK) falam para baixo-direita, no espaço vazio do
                    palco, sem cobrir o VERBO; os demais falam acima de si. */}
                <span
                  className={`absolute left-0 ${b.abaixo ? "top-9 -translate-x-[10%]" : "bottom-8 -translate-x-1/2"}`}
                >
                  <m.span
                    initial={{ opacity: 0, scale: 0.82, y: b.abaixo ? -6 : 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    className="aqua-glass aqua-ficha block w-max max-w-[11.5rem] rounded-2xl px-2.5 py-1.5 text-[0.62rem] leading-snug font-medium text-foreground"
                  >
                    {b.texto}
                  </m.span>
                </span>
              </span>
            ))}
          </AnimatePresence>
        </LazyMotion>
      </div>
    </>
  );
}
