import { seatStatus, TEAM, type SeatStatus, type TeamSeat } from "@/lib/outbound/team";
import type { DashboardData } from "./data";

/**
 * AQUÁRIO — o organograma vivo do time do MORK (proporção 9:19, "lente de vidro").
 *
 * Assinatura visual do console: um tanque escuro de vidro sobre a sala clara,
 * com o fio de comando luminoso ligando o MORK às cinco cadeiras (vazia em
 * tracejado), bolhas de dados subindo e a ficha de cada agente no hover/foco.
 * Look único e deliberado (escuro fixo, verde da marca); todo movimento respeita
 * prefers-reduced-motion. Sem PII: só nomes de agentes e títulos de demandas.
 */

const GLASS_KEYFRAMES = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes aqua-flutua { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes aqua-sobe { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: 0.85; } 90% { opacity: 0.25; } 100% { transform: translateY(-40rem); opacity: 0; } }
  @keyframes aqua-pulsa { 0%, 100% { box-shadow: 0 0 0 0 rgb(70 235 126 / 0.55); } 70% { box-shadow: 0 0 0 6px rgb(70 235 126 / 0); } }
  .aqua-assento { animation: aqua-flutua 8s ease-in-out infinite; }
  .aqua-bolha { animation: aqua-sobe linear infinite; }
  .aqua-viva { animation: aqua-pulsa 2.6s ease-in-out infinite; }
}
`;

/** Bolhas determinísticas (sem Math.random: purity + hidratação estável). */
const BUBBLES: Array<{ left: string; size: number; delay: string; dur: string }> = [
  { left: "12%", size: 5, delay: "0s", dur: "16s" },
  { left: "27%", size: 3, delay: "4s", dur: "13s" },
  { left: "46%", size: 6, delay: "9s", dur: "19s" },
  { left: "61%", size: 4, delay: "2s", dur: "15s" },
  { left: "76%", size: 3, delay: "6.5s", dur: "12s" },
  { left: "88%", size: 5, delay: "11s", dur: "17s" },
];

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

function Assento({ seat, status, index }: { seat: TeamSeat; status: SeatStatus; index: number }) {
  const isMork = seat.slug === "mork";
  return (
    <li
      tabIndex={0}
      aria-label={`${seat.hired ? seat.nome : "vaga aberta"}: ${seat.cargo}`}
      className="aqua-assento group relative flex items-center gap-3 rounded-2xl px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#46eb7e]/70"
      style={{ animationDuration: `${7.5 + index * 0.9}s`, animationDelay: `${index * 0.55}s` }}
    >
      {seat.hired ? (
        <span
          aria-hidden
          className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold text-[#052012] ${
            isMork ? "size-11 text-[0.8rem]" : "size-9 text-[0.68rem]"
          }`}
          style={{
            background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
            boxShadow: isMork
              ? "0 0 0 2px rgb(255 255 255 / 0.28), 0 0 26px rgb(70 235 126 / 0.5)"
              : "0 0 0 1px rgb(255 255 255 / 0.22), 0 0 14px rgb(70 235 126 / 0.3)",
          }}
        >
          {seat.monogram}
        </span>
      ) : (
        <span
          aria-hidden
          className="relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[#5d6f66] bg-white/[0.03] text-[#7a9587]"
        >
          <CadeiraIcon />
        </span>
      )}

      <span className="min-w-0">
        <span className="block truncate font-display text-[0.84rem] leading-tight font-bold text-[#eaf7ee]">
          {seat.hired ? seat.nome : "vaga aberta"}
          {isMork ? <span className="ml-1.5 text-[0.6rem] font-semibold text-[#46eb7e]">no comando</span> : null}
        </span>
        <span className="block truncate text-[0.66rem] text-[#8fae9d]">{seat.cargo}</span>
      </span>

      <span
        aria-hidden
        className={`ml-auto size-1.5 shrink-0 rounded-full ${
          seat.hired
            ? status.live
              ? "aqua-viva bg-[#46eb7e]"
              : "bg-[#4f6a5d]"
            : "border border-dashed border-[#5d6f66] bg-transparent"
        }`}
      />

      {/* Ficha do agente: hover/foco. Em telas largas desliza para a ESQUERDA do tanque. */}
      <span
        role="note"
        className="pointer-events-none invisible absolute top-full left-1/2 z-30 mt-2 w-60 -translate-x-1/2 rounded-2xl border border-white/15 bg-[#0a1712]/95 p-3.5 opacity-0 shadow-2xl backdrop-blur-md transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 2xl:top-1/2 2xl:right-full 2xl:left-auto 2xl:mt-0 2xl:mr-3 2xl:w-64 2xl:translate-x-0 2xl:-translate-y-1/2"
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
  const seats = TEAM.map((seat) => ({
    seat,
    status: seatStatus(seat, { demands: data.demands, activities: data.agentActivities, now }),
  }));
  const ultimas = [...data.agentActivities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  const tarefasAbertas = data.tasks.filter((t) => t.status === "aberta").length;
  const demandasPendentes = data.demands.filter((d) => d.status === "pendente").length;

  return (
    <section aria-label="Aquário: o time do MORK ao vivo" className="relative aspect-[9/19] w-[19.5rem] select-none">
      <style>{GLASS_KEYFRAMES}</style>

      {/* Tanque: fundo, luz, grade de dados, bolhas e reflexo (decorativo, clipado). */}
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/10">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(178deg, #103324 0%, #0a1d15 48%, #060f0b 100%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(70 235 126 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(70 235 126 / 0.5) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          className="absolute -top-20 left-1/2 h-60 w-80 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #46eb7e, transparent)" }}
        />
        {BUBBLES.map((b) => (
          <span
            key={b.left}
            className="aqua-bolha absolute -bottom-3 rounded-full"
            style={{
              left: b.left,
              width: `${b.size}px`,
              height: `${b.size}px`,
              background: "rgb(191 245 209 / 0.3)",
              animationDelay: b.delay,
              animationDuration: b.dur,
            }}
          />
        ))}
        <div
          className="absolute inset-y-5 left-2.5 w-9 rounded-full opacity-[0.09]"
          style={{ background: "linear-gradient(90deg, #ffffff, transparent)", filter: "blur(6px)" }}
        />
        <div
          className="absolute inset-x-0 top-0 h-16"
          style={{ background: "linear-gradient(180deg, rgb(255 255 255 / 0.1), transparent)" }}
        />
      </div>

      {/* Conteúdo da lente. */}
      <div className="relative flex h-full flex-col px-5 pt-5 pb-4">
        <header className="flex items-baseline justify-between">
          <p className="font-display text-[0.68rem] font-bold tracking-[0.24em] text-[#bff5d1] uppercase">Aquário</p>
          <p className="text-[0.64rem] text-[#8fae9d] tabular-nums">time ao vivo</p>
        </header>

        <ol aria-label="Organograma do time do MORK" className="relative mt-4 flex flex-1 flex-col justify-between">
          {/* Fio de comando: do MORK até a última cadeira. */}
          <span
            aria-hidden
            className="absolute top-8 bottom-7 left-[1.55rem] w-px"
            style={{ background: "linear-gradient(180deg, rgb(70 235 126 / 0.7), rgb(70 235 126 / 0.1))" }}
          />
          {seats.map(({ seat, status }, index) => (
            <Assento key={seat.slug} seat={seat} status={status} index={index} />
          ))}
        </ol>

        <footer className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm">
          <p className="text-[0.6rem] font-bold tracking-[0.18em] text-[#8fae9d] uppercase">Últimas atividades</p>
          {ultimas.length === 0 ? (
            <p className="mt-1.5 text-[0.7rem] leading-snug text-[#c9dcd1]">
              Silêncio no tanque. A primeira ação registrada aparece aqui.
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
          <p className="mt-2 border-t border-white/10 pt-1.5 text-[0.64rem] text-[#8fae9d] tabular-nums">
            {tarefasAbertas} tarefa(s) aberta(s) · {demandasPendentes} demanda(s) na fila
          </p>
        </footer>
      </div>
    </section>
  );
}
