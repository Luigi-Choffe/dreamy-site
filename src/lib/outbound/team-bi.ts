import type { AgentActivity, Demand, DemandKind } from "./types";
import { TEAM, type SeatSlug } from "./team";

/**
 * BI do time do MORK (aba MORK = central de gerenciamento dos agentes).
 * Derivações PURAS e testáveis sobre demandas e atividades — nada inventado:
 * a atribuição de uma demanda segue a ESPECIALIDADE da fila (o mesmo mapa de
 * kinds do Aquário): copy=NIX, leads=THAO, resposta=TAY,
 * operacao/outra=ZED, analise=MIRA (vaga; cai no MORK enquanto não há
 * contratação). Sem PII: só títulos de demanda e contagens.
 */

const JANELA_DIAS = 14;
const DIA_MS = 86_400_000;

export interface CargaCadeira {
  slug: SeatSlug;
  nome: string;
  cargo: string;
  hired: boolean;
  /** Tipos de demanda que caem nesta cadeira (rótulo curto na interface). */
  kinds: DemandKind[];
  pendentes: number;
  emAndamento: number;
  /** Concluídas na janela de 14 dias. */
  concluidas: number;
  /** Últimas entregas da janela (título + quando), mais recente primeiro. */
  entregas: Array<{ title: string; doneAt: string }>;
  /** Média de horas entre criar e concluir (só concluídas na janela). */
  horasMediaConclusao?: number;
}

/** Cadeira especialista de um tipo de demanda (primeiro contratado não-MORK; senão MORK). */
export function cadeiraDoKind(kind: DemandKind): SeatSlug {
  const especialista = TEAM.find((seat) => seat.slug !== "mork" && seat.hired && seat.kinds.includes(kind));
  return especialista?.slug ?? "mork";
}

/** Carga e entregas por cadeira na janela de 14 dias. Ordena: mais carga primeiro. */
export function cargaPorCadeira(demands: Demand[], now: Date = new Date()): CargaCadeira[] {
  const nowMs = now.getTime();
  const porSeat = new Map<SeatSlug, CargaCadeira>(
    TEAM.map((seat) => [
      seat.slug,
      {
        slug: seat.slug,
        nome: seat.nome,
        cargo: seat.cargo,
        hired: seat.hired,
        kinds: seat.kinds,
        pendentes: 0,
        emAndamento: 0,
        concluidas: 0,
        entregas: [],
      },
    ]),
  );

  const duracoes = new Map<SeatSlug, number[]>();
  for (const demand of demands) {
    const carga = porSeat.get(cadeiraDoKind(demand.kind));
    if (!carga) continue;
    if (demand.status === "pendente") carga.pendentes += 1;
    else if (demand.status === "em_andamento") carga.emAndamento += 1;
    else if (demand.status === "concluida" && demand.doneAt) {
      if (nowMs - Date.parse(demand.doneAt) > JANELA_DIAS * DIA_MS) continue;
      carga.concluidas += 1;
      carga.entregas.push({ title: demand.title, doneAt: demand.doneAt });
      const horas = (Date.parse(demand.doneAt) - Date.parse(demand.createdAt)) / 3_600_000;
      if (Number.isFinite(horas) && horas >= 0) {
        const lista = duracoes.get(carga.slug) ?? [];
        lista.push(horas);
        duracoes.set(carga.slug, lista);
      }
    }
  }

  for (const carga of porSeat.values()) {
    carga.entregas.sort((a, b) => b.doneAt.localeCompare(a.doneAt));
    carga.entregas = carga.entregas.slice(0, 2);
    const lista = duracoes.get(carga.slug);
    if (lista && lista.length > 0) {
      carga.horasMediaConclusao = lista.reduce((sum, h) => sum + h, 0) / lista.length;
    }
  }

  return [...porSeat.values()].sort(
    (a, b) =>
      b.pendentes + b.emAndamento + b.concluidas - (a.pendentes + a.emAndamento + a.concluidas) ||
      TEAM.findIndex((s) => s.slug === a.slug) - TEAM.findIndex((s) => s.slug === b.slug),
  );
}

export interface DiaDeRitmo {
  /** YYYY-MM-DD em UTC do carimbo (agrupamento estável e testável). */
  dateKey: string;
  total: number;
}

/** Atividades registradas por dia nos últimos `dias` (zeros preenchidos, mais antigo primeiro). */
export function ritmoDoTime(activities: AgentActivity[], now: Date = new Date(), dias = JANELA_DIAS): DiaDeRitmo[] {
  const chave = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const porDia = new Map<string, number>();
  for (let i = dias - 1; i >= 0; i -= 1) porDia.set(chave(now.getTime() - i * DIA_MS), 0);
  for (const activity of activities) {
    const key = chave(Date.parse(activity.at));
    if (porDia.has(key)) porDia.set(key, (porDia.get(key) ?? 0) + 1);
  }
  return [...porDia.entries()].map(([dateKey, total]) => ({ dateKey, total }));
}
