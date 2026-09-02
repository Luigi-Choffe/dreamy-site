import { seatStatus, TEAM } from "@/lib/outbound/team";
import { ICONE_DO_AGENTE } from "../team-icones";
import { cargaPorCadeira, ritmoDoTime, type CargaCadeira, type DiaDeRitmo } from "@/lib/outbound/team-bi";
import type { AgentActivity, Demand } from "@/lib/outbound/types";

type SeatSlugDoTime = (typeof TEAM)[number]["slug"];
import { FormComEstado } from "../form-com-estado";
import { SubmitButton } from "../pending";
import { solicitarAjusteComEstado } from "../stateful-actions";
import { Chip, DEMAND_KIND_LABELS, EmptyState, fmtInt, fmtQuando, MenuLinha, plural } from "../ui";

/**
 * GESTÃO DO TIME (aba MORK como central de gerenciamento dos agentes).
 *
 * Linguagem visual: os cartões são CRACHÁS DE VIDRO do time — a mesma matéria
 * do Aquário logo acima (`aqua-glass`, cargo em eyebrow verde como nas fichas,
 * dot de status que pulsa quando há trabalho real). Números em régua de
 * mini-stats com zeros mudos; gráficos com trilho de escala e a tipografia de
 * eyebrow do console.
 *
 * Método de dataviz (skill): forma antes de cor; rampa SEQUENCIAL de estado
 * com luminosidade monotônica (fila clara → andamento média → entregue verde,
 * a linguagem dos funis da casa) — identidade fica no TEXTO, nunca na cor;
 * encoding secundário sempre (legenda, números diretos, vãos, `title`); um
 * eixo só. Barras crescem com a mola da casa (CSS, motion-safe).
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
  { key: "concluidas", label: "entregues", cor: "bg-brand-strong" },
  { key: "emAndamento", label: "em andamento", cor: "bg-foreground-subtle" },
  { key: "pendentes", label: "na fila", cor: "bg-border-strong/60" },
] as const;

const EYEBROW = "font-display text-[0.62rem] font-bold tracking-[0.24em] text-foreground-muted uppercase";

function fmtHoras(h: number): string {
  if (h < 1) return "menos de 1h";
  if (h < 48) return `${fmtInt(Math.round(h))}h`;
  return `${(h / 24).toFixed(1).replace(".", ",")} dias`;
}

function Avatar({ slug, vago, live }: { slug: SeatSlugDoTime; vago?: boolean; live?: boolean }) {
  const Icone = ICONE_DO_AGENTE[slug];
  if (vago) {
    return (
      <span
        aria-hidden
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-white/50 text-foreground-subtle"
      >
        <Icone className="size-[1.05rem]" strokeWidth={2} aria-hidden focusable="false" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[#052012]"
      style={{
        background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
        boxShadow:
          "0 0 0 1px rgb(255 255 255 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.55), 0 0 14px rgb(70 235 126 / 0.32), 0 10px 22px -10px rgb(15 124 71 / 0.45)",
      }}
    >
      <Icone className="size-[1.15rem]" strokeWidth={2.2} aria-hidden focusable="false" />
      {/* O mesmo dot de vida do Aquário: pulsa só com trabalho real. */}
      <span
        className={`absolute -top-0.5 -right-0.5 size-2 rounded-full border border-background ${
          live ? "aqua-viva bg-[#46eb7e]" : "bg-border-strong"
        }`}
      />
    </span>
  );
}

/**
 * Régua de mini-stats do crachá: entregues · andamento · fila (zeros mudos).
 * Padrão Apple: superfície REBAIXADA em vez de borda — profundidade por luz,
 * hairlines internas quase invisíveis.
 */
function ReguaDeCarga({ carga }: { carga: CargaCadeira }) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-[rgb(11_11_12/0.05)] rounded-xl bg-[rgb(11_11_12/0.035)]">
      {SERIES.map((serie) => {
        const valor = carga[serie.key];
        const forte = serie.key === "concluidas" && valor > 0;
        return (
          <div key={serie.key} className="px-2 py-2.5 text-center">
            <dd
              className={`font-display text-xl leading-none font-bold tabular-nums ${
                forte ? "text-brand-strong" : valor > 0 ? "text-foreground" : "text-foreground-subtle/45"
              }`}
            >
              {fmtInt(valor)}
            </dd>
            <dt className="mt-1.5 text-[0.54rem] font-semibold tracking-[0.14em] text-foreground-subtle uppercase">
              {serie.label}
            </dt>
          </div>
        );
      })}
    </dl>
  );
}

/** Crachá de gestão de uma cadeira: quem é, o que faz agora, carga e entregas. */
function CartaoDeCadeira({
  carga,
  agora,
  live,
  isDemo,
}: {
  carga: CargaCadeira;
  agora: string;
  live: boolean;
  isDemo: boolean;
}) {
  const seat = TEAM.find((s) => s.slug === carga.slug);
  if (!seat) return null;

  if (!seat.hired) {
    // Vaga: convite honesto, sem números inventados (lei 6 do redesign).
    return (
      <article className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-border bg-white/25 p-5">
        <div className="flex items-center gap-3">
          <Avatar slug={carga.slug} vago />
          <div className="min-w-0">
            <h3 className="font-display text-base leading-tight font-bold text-foreground">{seat.nome}</h3>
            <p className="mt-0.5 truncate text-[0.6rem] font-semibold tracking-[0.14em] text-foreground-subtle uppercase">
              {seat.cargo} · vaga reservada
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-foreground-muted">{seat.motivo}</p>
      </article>
    );
  }

  return (
    <article className="aqua-glass flex flex-col gap-3.5 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <Avatar slug={carga.slug} live={live} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base leading-tight font-bold text-foreground" title={seat.nome}>
            {seat.nome}
          </h3>
          {/* Cargo em eyebrow verde: a MESMA linguagem da ficha do Aquário. */}
          <p
            className="mt-0.5 truncate text-[0.6rem] font-semibold tracking-[0.14em] text-brand-strong uppercase"
            title={seat.cargo}
          >
            {seat.cargo}
          </p>
        </div>
        {/* Módulo de ajuste do agente: o pedido do dono vira demanda na fila
            desta cadeira (gate humano; o MORK executa e presta contas). */}
        <MenuLinha rotulo={`Solicitar ajuste no ${seat.nome}`} gatilho="ajustar">
          <FormComEstado action={solicitarAjusteComEstado} resetOnOk className="flex w-72 flex-col gap-2 p-2 text-xs">
            <input type="hidden" name="seat" value={seat.slug} />
            {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
            <label htmlFor={`ajuste-${seat.slug}`} className="font-semibold text-foreground">
              O que ajustar no {seat.nome}?
            </label>
            <textarea
              id={`ajuste-${seat.slug}`}
              name="pedido"
              required
              rows={3}
              placeholder="ex.: assuntos mais curtos nos follow-ups"
              className="w-full resize-y rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground-subtle/80 hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none"
            />
            <div>
              <SubmitButton size="sm" loadingLabel="Enviando">
                Solicitar ajuste
              </SubmitButton>
            </div>
            <p className="text-[0.62rem] leading-snug text-foreground-subtle">
              Vira uma demanda na fila do {seat.nome}; o MORK executa e presta contas aqui.
            </p>
          </FormComEstado>
        </MenuLinha>
      </div>

      {/* A fala do agente: presença, não metadado. */}
      <p className="flex items-start gap-2 text-xs leading-snug text-foreground">
        <span
          aria-hidden
          className={`mt-[3px] size-1.5 shrink-0 rounded-full ${live ? "aqua-viva bg-brand" : "bg-border-strong"}`}
        />
        <span className="min-w-0">{agora}</span>
      </p>

      <ReguaDeCarga carga={carga} />

      {carga.entregas.length > 0 ? (
        <div>
          <p className="text-[0.56rem] font-bold tracking-[0.18em] text-foreground-subtle uppercase">
            Entregas recentes
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
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
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[rgb(11_11_12/0.06)] pt-3">
        {carga.kinds.map((kind) => (
          <Chip key={kind} tone="neutral">
            {DEMAND_KIND_LABELS[kind]}
          </Chip>
        ))}
        {carga.horasMediaConclusao !== undefined ? (
          <span
            className="ml-auto text-[0.62rem] text-foreground-subtle tabular-nums"
            title="Média entre abrir e concluir, nas entregas dos últimos 14 dias"
          >
            entrega média <span className="font-semibold text-foreground">{fmtHoras(carga.horasMediaConclusao)}</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Grade de crachás (contratados por carga; a vaga fecha a grade). */
export function GestaoDoTime({
  demands,
  activities,
  now,
  isDemo,
}: {
  demands: Demand[];
  activities: AgentActivity[];
  now: Date;
  isDemo: boolean;
}) {
  const cargas = cargaPorCadeira(demands, now);
  const statusInput = { demands, activities, now };
  const ordenadas = [...cargas.filter((c) => c.hired), ...cargas.filter((c) => !c.hired)];
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {ordenadas.map((carga) => {
        const seat = TEAM.find((s) => s.slug === carga.slug);
        const status = seat ? seatStatus(seat, statusInput) : undefined;
        return (
          <CartaoDeCadeira
            key={carga.slug}
            carga={carga}
            agora={status?.label ?? ""}
            live={status?.live ?? false}
            isDemo={isDemo}
          />
        );
      })}
    </div>
  );
}

/** Barras horizontais sobre trilho: fluxo de demandas por cadeira (14 dias). */
function GraficoCarga({ cargas }: { cargas: CargaCadeira[] }) {
  const comDados = cargas.filter((c) => c.hired && c.pendentes + c.emAndamento + c.concluidas > 0);
  const max = Math.max(1, ...comDados.map((c) => c.pendentes + c.emAndamento + c.concluidas));
  return (
    <figure className="aqua-glass flex flex-col rounded-2xl p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={EYEBROW}>Fluxo de demandas</span>
        <span className="text-[0.64rem] text-foreground-subtle tabular-nums">últimos 14 dias</span>
      </figcaption>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.64rem] text-foreground-muted">
        {SERIES.map((serie) => (
          <li key={serie.key} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-full ${serie.cor}`} />
            {serie.label}
          </li>
        ))}
      </ul>
      {comDados.length === 0 ? (
        <div className="mt-3">
          <EmptyState>Sem demandas nos últimos 14 dias — o BI nasce dos registros da fila.</EmptyState>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {comDados.map((carga, i) => {
            const total = carga.pendentes + carga.emAndamento + carga.concluidas;
            return (
              <li key={carga.slug} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 font-display text-[0.68rem] font-bold text-foreground">
                  {carga.nome}
                </span>
                {/* Trilho de escala: a barra vive sobre ele, nunca solta no ar. */}
                <span className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgb(11_11_12/0.04)]">
                  <span
                    className="bi-cresce-x absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden rounded-full"
                    style={{ width: `${(total / max) * 100}%`, animationDelay: `${i * 70}ms` }}
                  >
                    {SERIES.map((serie) =>
                      carga[serie.key] > 0 ? (
                        <span
                          key={serie.key}
                          title={`${carga.nome}: ${fmtInt(carga[serie.key])} ${serie.label} (14 dias)`}
                          className={`${serie.cor} h-full min-w-1.5 rounded-full`}
                          style={{ width: `${(carga[serie.key] / total) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </span>
                </span>
                <span className="w-8 shrink-0 text-right font-display text-sm font-bold text-foreground tabular-nums">
                  {fmtInt(total)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

/** Colunas por dia sobre linha de base: ritmo de atividades do time (14 dias). */
function GraficoRitmo({ ritmo }: { ritmo: DiaDeRitmo[] }) {
  const max = Math.max(1, ...ritmo.map((d) => d.total));
  const total = ritmo.reduce((sum, d) => sum + d.total, 0);
  const rotulo = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  return (
    <figure className="aqua-glass flex flex-col rounded-2xl p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={EYEBROW}>Ritmo do time</span>
        <span className="text-[0.64rem] text-foreground-subtle tabular-nums">
          {plural(total, "ação registrada", "ações registradas")} · 14 dias
        </span>
      </figcaption>
      <div
        aria-hidden
        className="mt-4 flex flex-1 items-end justify-center gap-1.5 border-b border-[rgb(11_11_12/0.08)] pb-px"
        style={{ minHeight: "6.5rem" }}
      >
        {ritmo.map((dia, i) => {
          const hoje = i === ritmo.length - 1;
          return (
            <span
              key={dia.dateKey}
              title={`${rotulo(dia.dateKey)} · ${plural(dia.total, "ação", "ações")}`}
              className={`bi-cresce-y w-full max-w-5 min-w-0 flex-1 rounded-t-[3px] ${
                hoje
                  ? "bg-brand-strong shadow-[0_0_10px_rgb(70_235_126/0.4)]"
                  : dia.total > 0
                    ? "bg-foreground-subtle/70"
                    : "bg-border/80"
              }`}
              style={{
                height: dia.total > 0 ? `${Math.max(8, (dia.total / max) * 100)}%` : "3px",
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
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <GraficoCarga cargas={cargas} />
        <GraficoRitmo ritmo={ritmo} />
      </div>
    </>
  );
}
