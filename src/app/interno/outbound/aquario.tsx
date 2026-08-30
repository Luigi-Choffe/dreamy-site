import { seatStatus, TEAM, teamGraph, type SeatStatus, type TeamSeat } from "@/lib/outbound/team";
import { AquarioRede } from "./aquario-rede";
import type { DashboardData } from "./data";

/**
 * AQUÁRIO v2 — a rede neural viva do time do MORK (lente 9:19).
 *
 * Assinatura do console: constelação de agentes num tanque de vidro escuro,
 * sinapses curvas ligando quem trabalha com quem (canvas em aquario-rede.tsx),
 * pulsos fortes SÓ quando há demanda real em andamento, cadeira vazia em
 * tracejado. Nós e fichas são HTML acessível (Tab + hover); o canvas é 100%
 * decorativo. Vidro = aproximação web de "liquid glass" (backdrop-filter em
 * camadas), NÃO o material oficial da Apple; com fallback sólido para
 * prefers-reduced-transparency. Sem PII em lugar nenhum.
 */

const GLASS_CSS = `
.aqua-glass {
  border: 1px solid rgb(255 255 255 / 0.16);
  background: linear-gradient(135deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.04)), rgb(10 23 18 / 0.55);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2), 0 14px 40px -18px rgb(0 0 0 / 0.6);
}
.aqua-ficha {
  background: linear-gradient(135deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.03)), rgb(8 18 13 / 0.93);
}
@media (prefers-reduced-transparency: reduce) {
  .aqua-glass,
  .aqua-ficha {
    background: rgb(9 20 15 / 0.97);
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
`;

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
  // Sempre para a ESQUERDA do nó: o tanque mora na borda direita da tela, então
  // abrir para a direita cortaria a ficha no viewport (achado do espelho v2).
  const fichaSide = "right-[calc(100%+0.75rem)] top-1/2 -translate-y-1/2";
  return (
    <li
      tabIndex={0}
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
                ? "0 0 0 2px rgb(255 255 255 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.55), 0 0 30px rgb(70 235 126 / 0.45)"
                : "0 0 0 1px rgb(255 255 255 / 0.25), inset 0 1px 0 rgb(255 255 255 / 0.5), 0 0 16px rgb(70 235 126 / 0.3)",
            }}
          >
            {seat.monogram}
            <span
              aria-hidden
              className={`absolute -top-0.5 -right-0.5 size-2 rounded-full border border-[#06170e] ${
                status.live ? "aqua-viva bg-[#46eb7e]" : "bg-[#40584c]"
              }`}
            />
          </span>
        ) : (
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[#5d6f66] bg-white/[0.03] text-[#7a9587]"
          >
            <CadeiraIcon />
          </span>
        )}
        <span className="pointer-events-none mt-1 text-center">
          <span className="block font-display text-[0.64rem] leading-tight font-bold tracking-wide text-[#eaf7ee]">
            {seat.hired ? seat.nome : "VAGA"}
          </span>
          {isMork ? <span className="block text-[0.55rem] font-semibold text-[#46eb7e]">no comando</span> : null}
        </span>
      </span>

      {/* Ficha do agente (hover/foco): abre para o lado livre do nó. */}
      <span
        role="note"
        className={`aqua-glass aqua-ficha pointer-events-none invisible absolute z-40 w-60 rounded-2xl p-3.5 opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 ${fichaSide}`}
      >
        <span className="block font-display text-sm font-bold text-[#eaf7ee]">
          {seat.hired ? seat.nome : "Cadeira vazia"}
        </span>
        <span className="mt-0.5 block text-[0.66rem] font-semibold tracking-[0.14em] text-[#46eb7e] uppercase">
          {seat.cargo}
        </span>
        <span className="mt-2 block text-[0.72rem] leading-relaxed text-[#c9dcd1]">
          <span className="font-semibold text-[#eaf7ee]">Função: </span>
          {seat.funcao}
        </span>
        <span className="mt-1.5 block text-[0.72rem] leading-relaxed text-[#c9dcd1]">
          <span className="font-semibold text-[#eaf7ee]">Por que existe: </span>
          {seat.motivo}
        </span>
        <span className="mt-1.5 block text-[0.72rem] leading-relaxed text-[#c9dcd1]">
          <span className="font-semibold text-[#eaf7ee]">Agora: </span>
          {status.label}
        </span>
      </span>
    </li>
  );
}

export function Aquario({ data }: { data: DashboardData }) {
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
      className="relative aspect-[9/19] w-[19.5rem] select-none"
    >
      <style>{GLASS_CSS}</style>

      {/* Tanque (decorativo, clipado): água funda + leve grade de dados + luz. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/10">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(178deg, #103324 0%, #0a1d15 48%, #060f0b 100%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(70 235 126 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(70 235 126 / 0.5) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div
          className="absolute -top-20 left-1/2 h-60 w-80 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #46eb7e, transparent)" }}
        />
        <div
          className="absolute inset-y-5 left-2.5 w-9 rounded-full opacity-[0.09]"
          style={{ background: "linear-gradient(90deg, #ffffff, transparent)", filter: "blur(6px)" }}
        />
        <div
          className="absolute inset-x-0 top-0 h-16"
          style={{ background: "linear-gradient(180deg, rgb(255 255 255 / 0.1), transparent)" }}
        />
      </div>

      {/* Lente. */}
      <div className="relative flex h-full flex-col px-4 pt-5 pb-4">
        <header className="flex items-baseline justify-between px-1">
          <p className="font-display text-[0.68rem] font-bold tracking-[0.24em] text-[#bff5d1] uppercase">Aquário</p>
          <p className="text-[0.64rem] text-[#8fae9d] tabular-nums">
            {sinapsesAtivas > 0 ? `${sinapsesAtivas} sinapse(s) ativa(s)` : "rede em repouso"}
          </p>
        </header>

        {/* Palco: canvas da rede atrás, nós acessíveis na frente. */}
        <div className="relative mt-2 min-h-0 flex-1">
          <AquarioRede nodes={redeNodes} links={graph.links} />
          <ol aria-label="Rede do time do MORK" className="absolute inset-0">
            {TEAM.map((seat) => {
              const node = nodeBySlug.get(seat.slug);
              const status = statuses.get(seat.slug);
              if (!node || !status) return null;
              return <NoDaRede key={seat.slug} seat={seat} status={status} x={node.x} y={node.y} />;
            })}
          </ol>
        </div>

        <footer className="aqua-glass mt-3 rounded-xl p-3">
          <p className="text-[0.6rem] font-bold tracking-[0.18em] text-[#8fae9d] uppercase">Últimas atividades</p>
          {ultimas.length === 0 ? (
            <p className="mt-1.5 text-[0.7rem] leading-snug text-[#c9dcd1]">
              Silêncio no tanque. A primeira ação registrada acende a rede.
            </p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1">
              {ultimas.map((a) => (
                <li key={a.id} className="flex gap-2 text-[0.7rem] leading-snug text-[#c9dcd1]">
                  <span className="shrink-0 text-[#6f8d7e] tabular-nums">{dateTimeShort.format(new Date(a.at))}</span>
                  <span className="min-w-0 truncate" title={a.summary}>
                    {a.summary}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 border-t border-white/10 pt-1.5 text-[0.62rem] text-[#8fae9d] tabular-nums">
            {tarefasAbertas} tarefa(s) aberta(s) · {demandasPendentes} demanda(s) na fila · pulso forte = trabalho real
            em andamento
          </p>
        </footer>
      </div>
    </section>
  );
}
