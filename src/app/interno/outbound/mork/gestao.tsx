import { seatStatus, TEAM } from "@/lib/outbound/team";
import { cargaPorCadeira, ritmoDoTime, type CargaCadeira, type DiaDeRitmo } from "@/lib/outbound/team-bi";
import type { AgentActivity, Demand } from "@/lib/outbound/types";
import { Chip, DEMAND_KIND_LABELS, EmptyState, fmtInt, fmtQuando, plural } from "../ui";

/**
 * GESTÃO DO TIME (aba MORK como central de gerenciamento dos agentes):
 * cartão de gestão por cadeira + BI da operação. Regras do método de dataviz:
 * - Forma antes de cor: barras horizontais para carga por cadeira (magnitude
 *   por identidade), colunas por dia para o ritmo (mudança no tempo).
 * - Cor por função: rampa SEQUENCIAL de estado com luminosidade monotônica
 *   (fila clara → andamento média → entregue no verde da casa — a mesma
 *   linguagem dos funis), nunca categórica por cadeira; identidade fica no
 *   TEXTO (nome ao lado da barra), não na cor.
 * - Encoding secundário sempre: legenda, números diretos, vãos de 2px e
 *   tooltip (`title`) por segmento — cor nunca carrega sozinha.
 * - Um eixo só; zeros mudos; texto em tokens de texto, nunca na cor da série.
 * Crescimento das barras com a mola da casa (CSS, motion-safe).
 */

const BI_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes bi-cresce-x { from { transform: scaleX(0); } }
  @keyframes bi-cresce-y { from { transform: scaleY(0); } }
  .bi-cresce-x { transform-origin: left center; animation: bi-cresce-x 0.6s cubic-bezier(0.22, 1.2, 0.36, 1) both; }
  .bi-cresce-y { transform-origin: center bottom; animation: bi-cresce-y 0.6s cubic-bezier(0.22, 1.2, 0.36, 1) both; }
}
`;

/** Rampa sequencial de estado (clara → escura → verde): fila, andamento, entregue. */
const SERIES = [
  { key: "concluidas", label: "entregues (14d)", cor: "bg-brand-strong" },
  { key: "emAndamento", label: "em andamento", cor: "bg-foreground-subtle" },
  { key: "pendentes", label: "na fila", cor: "bg-border-strong/60" },
] as const;

function fmtHoras(h: number): string {
  if (h < 1) return "menos de 1h";
  if (h < 48) return `${fmtInt(Math.round(h))}h`;
  return `${(h / 24).toFixed(1).replace(".", ",")} dias`;
}

function Avatar({ monogram, vago }: { monogram: string; vago?: boolean }) {
  if (vago) {
    return (
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-white/50 font-display text-[0.62rem] font-bold text-foreground-subtle"
      >
        {monogram}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full font-display text-[0.62rem] font-extrabold text-[#052012]"
      style={{
        background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
        boxShadow: "0 0 0 1px rgb(255 255 255 / 0.85), inset 0 1px 0 rgb(255 255 255 / 0.5)",
      }}
    >
      {monogram}
    </span>
  );
}

/** Micro-barra de fluxo do cartão: segmentos com vão de 2px, só o que existe. */
function BarraDeFluxo({ carga }: { carga: CargaCadeira }) {
  const total = carga.concluidas + carga.emAndamento + carga.pendentes;
  if (total === 0) return null;
  return (
    <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
      {SERIES.map((serie) =>
        carga[serie.key] > 0 ? (
          <span
            key={serie.key}
            className={`${serie.cor} h-full rounded-full`}
            style={{ width: `${(carga[serie.key] / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

/** Cartão de gestão de uma cadeira: quem é, o que faz agora, carga e entregas. */
function CartaoDeCadeira({ carga, agora }: { carga: CargaCadeira; agora: string }) {
  const seat = TEAM.find((s) => s.slug === carga.slug);
  if (!seat) return null;
  const contagens = [
    carga.concluidas > 0 ? plural(carga.concluidas, "entregue") : null,
    carga.emAndamento > 0 ? plural(carga.emAndamento, "em andamento", "em andamento") : null,
    carga.pendentes > 0 ? plural(carga.pendentes, "na fila", "na fila") : null,
  ].filter(Boolean);

  if (!seat.hired) {
    // Vaga: convite honesto, sem números inventados (lei 6 do redesign).
    return (
      <article className="flex flex-col gap-2 rounded-xl border border-dashed border-border-strong bg-background-secondary/30 p-4">
        <div className="flex items-center gap-2.5">
          <Avatar monogram={seat.monogram} vago />
          <div className="min-w-0">
            <h3 className="font-display text-small font-bold text-foreground">{seat.nome} · vaga reservada</h3>
            <p className="truncate text-xs text-foreground-subtle" title={seat.cargo}>
              {seat.cargo}
            </p>
          </div>
        </div>
        <p className="text-xs leading-snug text-foreground-muted">{seat.motivo}</p>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow duration-(--duration-fast) hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <Avatar monogram={seat.monogram} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-small font-bold text-foreground" title={seat.nome}>
            {seat.nome}
          </h3>
          <p className="truncate text-xs text-foreground-subtle" title={seat.cargo}>
            {seat.cargo}
          </p>
        </div>
      </div>
      <p className="text-xs leading-snug text-foreground-muted">
        <span className="font-semibold text-foreground">Agora: </span>
        {agora}
      </p>
      <BarraDeFluxo carga={carga} />
      {contagens.length > 0 ? (
        <p className="text-xs text-foreground-subtle tabular-nums">{contagens.join(" · ")}</p>
      ) : (
        <p className="text-xs text-foreground-subtle">Fila limpa; é só abrir uma demanda.</p>
      )}
      {carga.entregas.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-border pt-2">
          {carga.entregas.map((entrega) => (
            <li key={entrega.doneAt + entrega.title} className="flex items-baseline gap-2 text-xs">
              <span aria-hidden className="size-1 shrink-0 translate-y-[-1px] rounded-full bg-brand" />
              <span className="min-w-0 truncate text-foreground" title={entrega.title}>
                {entrega.title}
              </span>
              <span className="ml-auto shrink-0 text-foreground-subtle tabular-nums">
                {fmtQuando(entrega.doneAt).slice(0, 5)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-auto flex flex-wrap items-center gap-1 border-t border-border pt-2 text-[0.62rem] text-foreground-subtle">
        atende
        {carga.kinds.map((kind) => (
          <Chip key={kind} tone="outline">
            {DEMAND_KIND_LABELS[kind]}
          </Chip>
        ))}
        {carga.horasMediaConclusao !== undefined ? (
          <span className="ml-auto tabular-nums" title="Média entre abrir e concluir, nas entregas dos últimos 14 dias">
            entrega média: {fmtHoras(carga.horasMediaConclusao)}
          </span>
        ) : null}
      </p>
    </article>
  );
}

/** Grade de cartões de gestão (contratados por carga; a vaga fecha a grade). */
export function GestaoDoTime({
  demands,
  activities,
  now,
}: {
  demands: Demand[];
  activities: AgentActivity[];
  now: Date;
}) {
  const cargas = cargaPorCadeira(demands, now);
  const statusInput = { demands, activities, now };
  const ordenadas = [...cargas.filter((c) => c.hired), ...cargas.filter((c) => !c.hired)];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ordenadas.map((carga) => {
        const seat = TEAM.find((s) => s.slug === carga.slug);
        const agora = seat ? seatStatus(seat, statusInput).label : "";
        return <CartaoDeCadeira key={carga.slug} carga={carga} agora={agora} />;
      })}
    </div>
  );
}

/** Barras horizontais: fluxo de demandas por cadeira (14 dias). */
function GraficoCarga({ cargas }: { cargas: CargaCadeira[] }) {
  const comDados = cargas.filter((c) => c.hired && c.pendentes + c.emAndamento + c.concluidas > 0);
  const max = Math.max(1, ...comDados.map((c) => c.pendentes + c.emAndamento + c.concluidas));
  if (comDados.length === 0) {
    return <EmptyState>Sem demandas nos últimos 14 dias — o BI nasce dos registros da fila.</EmptyState>;
  }
  return (
    <figure className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-small font-bold text-foreground">Fluxo de demandas por cadeira</span>
        <span className="text-xs text-foreground-subtle">últimos 14 dias</span>
      </figcaption>
      {/* Legenda: a cor nunca carrega sozinha. */}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.66rem] text-foreground-muted">
        {SERIES.map((serie) => (
          <li key={serie.key} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-full ${serie.cor}`} />
            {serie.label}
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-col gap-2.5">
        {comDados.map((carga, i) => {
          const total = carga.pendentes + carga.emAndamento + carga.concluidas;
          return (
            <li key={carga.slug} className="flex items-center gap-3 text-xs">
              <span className="w-16 shrink-0 font-display font-bold text-foreground">{carga.nome}</span>
              <span className="flex h-3 min-w-0 flex-1 items-stretch gap-0.5">
                <span
                  className="bi-cresce-x flex gap-0.5 overflow-hidden rounded-full"
                  style={{ width: `${(total / max) * 100}%`, animationDelay: `${i * 70}ms` }}
                >
                  {SERIES.map((serie) =>
                    carga[serie.key] > 0 ? (
                      <span
                        key={serie.key}
                        title={`${carga.nome}: ${fmtInt(carga[serie.key])} ${serie.label}`}
                        className={`${serie.cor} h-full min-w-1 rounded-full`}
                        style={{ width: `${(carga[serie.key] / total) * 100}%` }}
                      />
                    ) : null,
                  )}
                </span>
              </span>
              <span className="w-8 shrink-0 text-right font-semibold text-foreground tabular-nums">
                {fmtInt(total)}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** Colunas por dia: ritmo de atividades do time (14 dias); hoje no verde. */
function GraficoRitmo({ ritmo }: { ritmo: DiaDeRitmo[] }) {
  const max = Math.max(1, ...ritmo.map((d) => d.total));
  const total = ritmo.reduce((sum, d) => sum + d.total, 0);
  const rotulo = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  return (
    <figure className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-small font-bold text-foreground">Ritmo do time</span>
        <span className="text-xs text-foreground-subtle tabular-nums">
          {plural(total, "ação registrada", "ações registradas")} · 14 dias
        </span>
      </figcaption>
      <div aria-hidden className="mt-3 flex h-24 items-end gap-1">
        {ritmo.map((dia, i) => {
          const hoje = i === ritmo.length - 1;
          return (
            <span
              key={dia.dateKey}
              title={`${rotulo(dia.dateKey)} · ${plural(dia.total, "ação", "ações")}`}
              className={`bi-cresce-y min-w-0 flex-1 rounded-t ${hoje ? "bg-brand-strong" : "bg-foreground-subtle/70"}`}
              style={{
                height: dia.total > 0 ? `${Math.max(6, (dia.total / max) * 100)}%` : "2px",
                animationDelay: `${i * 30}ms`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.62rem] text-foreground-subtle tabular-nums">
        <span>{rotulo(ritmo[0]?.dateKey ?? "")}</span>
        <span className="font-semibold text-brand-strong">hoje {fmtInt(ritmo.at(-1)?.total ?? 0)}</span>
      </div>
    </figure>
  );
}

/** O BI da operação: carga por cadeira + ritmo diário, lado a lado. */
export function BiDaOperacao({
  demands,
  activities,
  now,
}: {
  demands: Demand[];
  activities: AgentActivity[];
  now: Date;
}) {
  const cargas = cargaPorCadeira(demands, now);
  const ritmo = ritmoDoTime(activities, now);
  return (
    <>
      <style>{BI_CSS}</style>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraficoCarga cargas={cargas} />
        <GraficoRitmo ritmo={ritmo} />
      </div>
    </>
  );
}
