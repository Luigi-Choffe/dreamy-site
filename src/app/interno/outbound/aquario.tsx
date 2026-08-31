import { seatStatus, TEAM, teamGraph, type SeatStatus, type TeamSeat } from "@/lib/outbound/team";
import { AquarioRede } from "./aquario-rede";
import type { DashboardData } from "./data";

/**
 * AQUÁRIO v3 — a rede do time do MORK flutuando na página (lente 9:19).
 *
 * Sem tanque: a constelação vive direto sobre o fundo claro do console, como
 * uma projeção. O único material é VIDRO FOSCO claro (base e fichas;
 * aproximação web de "liquid glass" com backdrop-filter, NÃO o material
 * oficial da Apple), e toda a luz é o verde do logo Dreamy (--brand-primary
 * #46eb7e). Sinapses curvas no canvas (aquario-rede.tsx); pulsos fortes SÓ
 * quando há demanda real em andamento; cadeira vazia em tracejado. Nós e
 * fichas são HTML acessível (Tab + hover); o canvas é 100% decorativo.
 * Fallback sólido para prefers-reduced-transparency. Sem PII em lugar nenhum.
 */

const GLASS_CSS = `
.aqua-glass {
  border: 1px solid rgb(11 11 12 / 0.08);
  background: linear-gradient(150deg, rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.42));
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.95), 0 18px 44px -22px rgb(11 11 12 / 0.28);
}
.aqua-ficha {
  background: linear-gradient(150deg, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0.84));
}
@media (prefers-reduced-transparency: reduce) {
  .aqua-glass,
  .aqua-ficha {
    background: var(--surface);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes aqua-pulsa {
    0%, 100% { box-shadow: 0 0 0 0 rgb(70 235 126 / 0.55); }
    70% { box-shadow: 0 0 0 6px rgb(70 235 126 / 0); }
  }
  .aqua-viva { animation: aqua-pulsa 2.6s ease-in-out infinite; }
}
[data-ficha] {
  opacity: 0;
  visibility: hidden;
  transition: opacity 200ms ease, visibility 200ms;
}
`;

/**
 * Uma regra :has por cadeira: hover/foco no nó acende a ficha correspondente no
 * painel central. A ficha vive DENTRO da lente e nunca mais é cortada por
 * rolagem ou borda de tela (P0 #1 de docs/MELHORIAS-CONSOLE.md).
 */
const FICHA_CSS = TEAM.map(
  (seat) =>
    `.aqua-stage:has(li[data-seat="${seat.slug}"]:hover) [data-ficha="${seat.slug}"], ` +
    `.aqua-stage:has(li[data-seat="${seat.slug}"]:focus-visible) [data-ficha="${seat.slug}"] ` +
    `{ opacity: 1; visibility: visible; }`,
).join("\n");

const dateTimeShort = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function CadeiraIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      <path d="M4 2.5v7" />
      <path d="M4 6.5h8" />
      <path d="M12 6.5v3" />
      <path d="M4 9.5h8" />
      <path d="M4.5 9.5 4 13.5M11.5 9.5l.5 4" />
    </svg>
  );
}

function NoDaRede({ seat, status, x, y }: { seat: TeamSeat; status: SeatStatus; x: number; y: number }) {
  const isMork = seat.slug === "mork";
  return (
    <li
      tabIndex={0}
      data-seat={seat.slug}
      aria-describedby={`ficha-${seat.slug}`}
      aria-label={`${seat.hired ? seat.nome : "vaga aberta"}: ${seat.cargo}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#46eb7e]/70"
    >
      <span className="relative flex flex-col items-center">
        {seat.hired ? (
          <span
            aria-hidden
            className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold text-[#052012] ${
              isMork ? "size-12 text-[0.82rem]" : "size-10 text-[0.68rem]"
            }`}
            style={{
              background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
              boxShadow: isMork
                ? "0 0 0 2px rgb(255 255 255 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.55), 0 14px 30px -10px rgb(15 124 71 / 0.5)"
                : "0 0 0 1px rgb(255 255 255 / 0.85), inset 0 1px 0 rgb(255 255 255 / 0.5), 0 10px 22px -8px rgb(15 124 71 / 0.4)",
            }}
          >
            {seat.monogram}
            <span
              aria-hidden
              className={`absolute -top-0.5 -right-0.5 size-2 rounded-full border border-background ${
                status.live ? "aqua-viva bg-[#46eb7e]" : "bg-border-strong"
              }`}
            />
          </span>
        ) : (
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-white/50 text-foreground-subtle"
          >
            <CadeiraIcon />
          </span>
        )}
        <span className="pointer-events-none mt-1 text-center">
          <span className="block font-display text-[0.64rem] leading-tight font-bold tracking-wide text-foreground">
            {seat.hired ? seat.nome : "VAGA"}
          </span>
          {isMork ? <span className="block text-[0.55rem] font-semibold text-brand-strong">no comando</span> : null}
        </span>
      </span>
    </li>
  );
}

export function Aquario({
  data,
  variante = "coluna",
}: {
  data: DashboardData;
  /** "coluna": lente 9:19 completa (aba MORK). "sala": preenche o slot da sala lateral, sem rodapé. */
  variante?: "coluna" | "sala";
}) {
  const now = new Date();
  const statusInput = { demands: data.demands, activities: data.agentActivities, now };
  const statuses = new Map(TEAM.map((seat) => [seat.slug, seatStatus(seat, statusInput)] as const));
  const graph = teamGraph(statusInput);
  const nodeBySlug = new Map(graph.nodes.map((n) => [n.slug, n]));
  const redeNodes = graph.nodes.map((n) => ({ ...n, big: n.slug === "mork" }));

  const ultimas = [...data.agentActivities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  const tarefasAbertas = data.tasks.filter((t) => t.status === "aberta").length;
  const demandasPendentes = data.demands.filter((d) => d.status === "pendente").length;
  const sinapsesAtivas = graph.links.filter((l) => l.active).length;

  return (
    <section
      aria-label="Aquário: a rede viva do time do MORK"
      className={
        variante === "sala" ? "relative h-full w-full select-none" : "relative aspect-[9/19] w-[19.5rem] select-none"
      }
    >
      <style>{GLASS_CSS + FICHA_CSS}</style>

      {/* Luz ambiente (decorativa): a projeção se assenta num brilho da marca. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-10 bottom-4 opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(55% 40% at 50% 36%, rgb(70 235 126 / 0.18), transparent 70%), radial-gradient(45% 18% at 50% 94%, rgb(70 235 126 / 0.14), transparent 75%)",
        }}
      />

      <div className="relative flex h-full flex-col">
        <header className="flex items-baseline justify-between px-1">
          <p className="font-display text-[0.68rem] font-bold tracking-[0.24em] text-foreground-muted uppercase">
            Aquário
          </p>
          <p
            className={`text-[0.64rem] tabular-nums ${
              sinapsesAtivas > 0 ? "font-semibold text-brand-strong" : "text-foreground-subtle"
            }`}
          >
            {sinapsesAtivas > 0 ? `${sinapsesAtivas} sinapse(s) ativa(s)` : "rede em repouso"}
          </p>
        </header>

        {/* Palco: canvas da rede atrás, nós acessíveis na frente. */}
        <div className="aqua-stage relative mt-2 min-h-0 flex-1">
          <AquarioRede nodes={redeNodes} links={graph.links} />
          <ol aria-label="Rede do time do MORK" className="absolute inset-0">
            {TEAM.map((seat) => {
              const node = nodeBySlug.get(seat.slug);
              const status = statuses.get(seat.slug);
              if (!node || !status) return null;
              return <NoDaRede key={seat.slug} seat={seat} status={status} x={node.x} y={node.y} />;
            })}
          </ol>
          {/* Painel de fichas DENTRO da lente: acende no hover/foco do nó (FICHA_CSS)
              e é imune a clipping de rolagem ou borda de tela, em qualquer largura. */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 grid -translate-y-1/2 px-1">
            {TEAM.map((seat) => {
              const status = statuses.get(seat.slug);
              if (!status) return null;
              return (
                <div
                  key={seat.slug}
                  id={`ficha-${seat.slug}`}
                  data-ficha={seat.slug}
                  role="note"
                  className="aqua-glass aqua-ficha rounded-2xl p-3.5 [grid-area:1/1]"
                >
                  <span className="block font-display text-sm font-bold text-foreground">
                    {seat.hired ? seat.nome : "Cadeira vazia"}
                  </span>
                  <span className="mt-0.5 block text-[0.66rem] font-semibold tracking-[0.14em] text-brand-strong uppercase">
                    {seat.cargo}
                  </span>
                  <span className="mt-2 block text-[0.72rem] leading-relaxed text-foreground-muted">
                    <span className="font-semibold text-foreground">Função: </span>
                    {seat.funcao}
                  </span>
                  <span className="mt-1.5 block text-[0.72rem] leading-relaxed text-foreground-muted">
                    <span className="font-semibold text-foreground">Por que existe: </span>
                    {seat.motivo}
                  </span>
                  <span className="mt-1.5 block text-[0.72rem] leading-relaxed text-foreground-muted">
                    <span className="font-semibold text-foreground">Agora: </span>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Base em vidro fosco: o "pé" da projeção (só na lente completa; na sala, o chat assume). */}
        <footer className={variante === "sala" ? "hidden" : "aqua-glass mt-3 rounded-2xl p-3"}>
          <p className="text-[0.6rem] font-bold tracking-[0.18em] text-foreground-subtle uppercase">
            Últimas atividades
          </p>
          {ultimas.length === 0 ? (
            <p className="mt-1.5 text-[0.7rem] leading-snug text-foreground-muted">
              Silêncio na rede. A primeira ação registrada acende as sinapses.
            </p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1">
              {ultimas.map((a) => (
                <li key={a.id} className="flex gap-2 text-[0.7rem] leading-snug text-foreground-muted">
                  <span className="shrink-0 text-foreground-subtle tabular-nums">
                    {dateTimeShort.format(new Date(a.at))}
                  </span>
                  <span className="min-w-0 truncate" title={a.summary}>
                    {a.summary}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 border-t border-border pt-1.5 text-[0.62rem] text-foreground-subtle tabular-nums">
            {tarefasAbertas} tarefa(s) aberta(s) · {demandasPendentes} demanda(s) na fila · pulso forte = trabalho real
            em andamento
          </p>
        </footer>
      </div>
    </section>
  );
}
