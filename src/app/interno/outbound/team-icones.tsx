import { Compass, Feather, Gem, Inbox, Radar, Wrench, type LucideIcon } from "lucide-react";
import type { SeatSlug } from "@/lib/outbound/team";

/**
 * O ícone de cada agente — a identidade visual da cadeira (pedido do Luigi,
 * 2026-09-02), sempre par do nome curto: MORK dá o rumo (bússola), NIX escreve
 * (pena), KAI garimpa leads (gema), TAY cuida da caixa (inbox), ZED constrói a
 * plataforma (chave), MIRA lê o funil (radar). Usado nos nós do Aquário e nos
 * crachás; o monograma segue como reserva (chat, contextos minúsculos).
 */
export const ICONE_DO_AGENTE: Record<SeatSlug, LucideIcon> = {
  mork: Compass,
  verbo: Feather,
  garimpo: Gem,
  trato: Inbox,
  forja: Wrench,
  mira: Radar,
};
