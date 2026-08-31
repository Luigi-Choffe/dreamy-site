import type { AgentActivity, Demand, DemandKind } from "./types";

/**
 * O time de agentes do MORK (ADR-025): registro canônico das cadeiras exibidas
 * no Aquário do console. As identidades completas vivem em `.claude/agents/`;
 * aqui fica a ficha de apresentação e a derivação PURA do "o que está fazendo
 * agora" a partir das demandas e da prestação de contas (sem PII).
 *
 * Teto de 5 cadeiras abaixo do MORK; cadeira vazia aparece como vaga. Contratar
 * é decisão do MORK; demitir exige permissão do Luigi.
 */

export type SeatSlug = "mork" | "verbo" | "garimpo" | "trato" | "forja" | "mira";

export interface TeamSeat {
  slug: SeatSlug;
  nome: string;
  cargo: string;
  /** Duas letras do nó no organograma. */
  monogram: string;
  /** Principal função (ficha do aquário). */
  funcao: string;
  /** Por que a cadeira foi criada (ou por que segue vazia). */
  motivo: string;
  hired: boolean;
  /** Tipos de demanda que caem no colo desta cadeira. */
  kinds: DemandKind[];
}

export const TEAM: TeamSeat[] = [
  {
    slug: "mork",
    nome: "MORK",
    cargo: "Diretor de vendas (IA)",
    monogram: "MK",
    funcao: "Coordena o funil inteiro: campanhas, pipeline, fila de demandas e o time de agentes.",
    motivo: "Contratado pelo Luigi para tocar o outbound e transformar a plataforma no CRM piloto da Dreamy.",
    hired: true,
    kinds: ["analise", "operacao", "outra"],
  },
  {
    slug: "verbo",
    nome: "VERBO",
    cargo: "Redator de cold e-mail",
    monogram: "VB",
    funcao: "Escreve e revisa a copy das campanhas na voz do Luigi, sempre validada pelo linter.",
    motivo: "Copy é o produto do outbound: um e-mail com cara de robô queima a lista e o domínio.",
    hired: true,
    kinds: ["copy"],
  },
  {
    slug: "garimpo",
    nome: "GARIMPO",
    cargo: "Analista de leads e ICP",
    monogram: "GA",
    funcao: "Importa bases do Clay, valida ICP, segmenta indústrias e escreve as aberturas.",
    motivo: "Lista ruim derruba a entregabilidade; o GARIMPO protege o funil na porta de entrada.",
    hired: true,
    kinds: ["leads"],
  },
  {
    slug: "trato",
    nome: "TRATO",
    cargo: "Gestor de respostas e CRM",
    monogram: "TR",
    funcao: "Triagem da caixa, classificação no mesmo dia, follow-ups e higiene do pipeline.",
    motivo: "Interessado sem resposta esfria em horas; o TRATO existe para isso nunca acontecer.",
    hired: true,
    kinds: ["resposta"],
  },
  {
    slug: "forja",
    nome: "FORJA",
    cargo: "Engenheiro da plataforma",
    monogram: "FO",
    funcao: "Evolui o console, o store e as CLIs no padrão da casa, com testes e sem tocar o motor.",
    motivo: "A plataforma é o produto vendável; alguém precisa forjá-la sem quebrar o que já opera.",
    hired: true,
    kinds: ["operacao", "outra"],
  },
  {
    slug: "mira",
    nome: "MIRA",
    cargo: "Analista de estratégia",
    monogram: "MI",
    funcao: "Vai ler funil, rampa e segmentos para recomendar o próximo movimento de vendas.",
    motivo: "Vaga reservada: análise séria pede massa de dados, e o primeiro mês ainda está gerando a dela.",
    hired: false,
    kinds: ["analise"],
  },
];

export interface SeatStatus {
  /** Frase curta do que a cadeira está fazendo agora (sem PII). */
  label: string;
  /** Acende o pulso verde do nó. */
  live: boolean;
}

const TWO_DAYS_MS = 2 * 86_400_000;
const WEEK_MS = 7 * 86_400_000;

/** Deriva "o que está fazendo agora" das demandas e atividades. Pura e testável. */
export function seatStatus(
  seat: TeamSeat,
  input: { demands: Demand[]; activities: AgentActivity[]; now?: Date },
): SeatStatus {
  const nowMs = (input.now ?? new Date()).getTime();
  if (!seat.hired) {
    return { label: "cadeira vazia; a contratação sai quando houver dor e dado para ela.", live: false };
  }
  if (seat.slug === "mork") {
    const last = [...input.activities].filter((a) => a.actor === "mork").sort((a, b) => b.at.localeCompare(a.at))[0];
    if (last && nowMs - Date.parse(last.at) <= TWO_DAYS_MS) return { label: last.summary, live: true };
    return { label: "Estou coordenando a operação e o disparo diário das 09:05.", live: true };
  }
  const doing = input.demands
    .filter((d) => d.status === "em_andamento" && seat.kinds.includes(d.kind))
    .sort((a, b) => (b.claimedAt ?? b.createdAt).localeCompare(a.claimedAt ?? a.createdAt))[0];
  if (doing) return { label: `Estou na demanda: ${doing.title}`, live: true };
  const delivered = input.demands
    .filter(
      (d) =>
        d.status === "concluida" &&
        seat.kinds.includes(d.kind) &&
        d.doneAt !== undefined &&
        nowMs - Date.parse(d.doneAt) <= WEEK_MS,
    )
    .sort((a, b) => (b.doneAt as string).localeCompare(a.doneAt as string))[0];
  if (delivered) return { label: `Acabei de entregar: ${delivered.title}`, live: false };
  return { label: "Estou disponível; é só abrir uma demanda na aba Demandas.", live: false };
}

/* ─── Falas ambiente (Aquário v4: balões de conversa) ────────────────────── */

/** O que cada cadeira vigia quando não há registro recente (verdade de função, não claim de ação). */
const IDLE_FALAS: Record<SeatSlug, string> = {
  mork: "De olho no funil e na fila de demandas.",
  verbo: "De olho na copy das campanhas no ar.",
  garimpo: "De olho na qualidade da lista e no ICP.",
  trato: "De olho na caixa de respostas.",
  forja: "De olho no console e nos testes.",
  mira: "",
};

const FALA_MAX = 72;

/**
 * Falas dos balões do Aquário, por cadeira. Regra anti-enfeite-mentiroso: a
 * fala é o STATUS real da cadeira (demanda em andamento, entrega recente ou o
 * registro do MORK — o diário só tem atores mork/console/sistema) mais a
 * vigília fiel do cargo. Pura e sem PII (labels já são limpos).
 */
export function seatFalas(input: {
  demands: Demand[];
  activities: AgentActivity[];
  now?: Date;
}): Record<SeatSlug, string[]> {
  const trunca = (s: string) => (s.length > FALA_MAX ? `${s.slice(0, FALA_MAX - 1).trimEnd()}…` : s);
  const out = {} as Record<SeatSlug, string[]>;
  for (const seat of TEAM) {
    if (!seat.hired) {
      out[seat.slug] = [];
      continue;
    }
    const status = seatStatus(seat, input);
    const falas: string[] = [];
    // O status vira fala quando carrega fato (demanda, entrega, registro); o
    // texto padrão de disponibilidade não entra — a vigília idle cobre o caso.
    if (!status.label.startsWith("Estou disponível")) falas.push(trunca(status.label));
    if (IDLE_FALAS[seat.slug]) falas.push(IDLE_FALAS[seat.slug]);
    out[seat.slug] = falas;
  }
  return out;
}

/* ─── Grafo da rede (Aquário v2: constelação neural) ─────────────────────── */

export interface TeamGraphNode {
  slug: SeatSlug;
  /** Posição no palco em % (constelação orgânica, não uma linha). */
  x: number;
  y: number;
  hired: boolean;
  live: boolean;
}

export type TeamLinkKind = "comando" | "colaboracao" | "vaga";

export interface TeamGraphLink {
  from: SeatSlug;
  to: SeatSlug;
  kind: TeamLinkKind;
  /** Sinapse acesa = trabalho REAL em andamento (nada de enfeite mentiroso). */
  active: boolean;
}

const NODE_POS: Record<SeatSlug, { x: number; y: number }> = {
  mork: { x: 50, y: 12 },
  verbo: { x: 24, y: 31 },
  garimpo: { x: 76, y: 39 },
  trato: { x: 27, y: 56 },
  forja: { x: 73, y: 67 },
  mira: { x: 47, y: 80 },
};

/** Relações de trabalho reais: copy depende de leads, leads alimentam respostas, CRM pede plataforma. */
const COLLAB_PAIRS: Array<[SeatSlug, SeatSlug]> = [
  ["verbo", "garimpo"],
  ["garimpo", "trato"],
  ["trato", "forja"],
];

const COLLAB_RECENT_MS = 7 * 86_400_000;

/**
 * Grafo vivo do time: nós na constelação + sinapses. Comando (MORK → agente)
 * acende quando o agente está numa demanda; colaboração (agente ↔ agente)
 * acende quando os dois tocaram a MESMA campanha em demandas recentes.
 */
export function teamGraph(input: { demands: Demand[]; activities: AgentActivity[]; now?: Date }): {
  nodes: TeamGraphNode[];
  links: TeamGraphLink[];
} {
  const nowMs = (input.now ?? new Date()).getTime();
  const statuses = new Map(TEAM.map((seat) => [seat.slug, seatStatus(seat, input)] as const));
  const nodes: TeamGraphNode[] = TEAM.map((seat) => ({
    slug: seat.slug,
    ...NODE_POS[seat.slug],
    hired: seat.hired,
    live: seat.hired && (statuses.get(seat.slug)?.live ?? false),
  }));

  const links: TeamGraphLink[] = [];
  for (const seat of TEAM) {
    if (seat.slug === "mork") continue;
    links.push({
      from: "mork",
      to: seat.slug,
      kind: seat.hired ? "comando" : "vaga",
      active: seat.hired && (statuses.get(seat.slug)?.live ?? false),
    });
  }

  const seatsByCampaign = new Map<string, Set<SeatSlug>>();
  for (const demand of input.demands) {
    if (!demand.campaignSlug) continue;
    if (demand.status !== "em_andamento" && demand.status !== "concluida") continue;
    const ref = demand.doneAt ?? demand.claimedAt ?? demand.createdAt;
    if (nowMs - Date.parse(ref) > COLLAB_RECENT_MS) continue;
    for (const seat of TEAM) {
      if (seat.slug === "mork" || !seat.hired || !seat.kinds.includes(demand.kind)) continue;
      const set = seatsByCampaign.get(demand.campaignSlug) ?? new Set<SeatSlug>();
      set.add(seat.slug);
      seatsByCampaign.set(demand.campaignSlug, set);
    }
  }
  for (const [a, b] of COLLAB_PAIRS) {
    const active = [...seatsByCampaign.values()].some((set) => set.has(a) && set.has(b));
    links.push({ from: a, to: b, kind: "colaboracao", active });
  }

  return { nodes, links };
}
