import type { OutboundState } from "./types";

/** Compartilhado pelos dois stores (arquivos e Postgres) — evita import circular. */
export const DEFAULT_STATE: OutboundState = { armed: false };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lock considerado obsoleto (processo morto) depois deste prazo. */
export const LOCK_STALE_MS = 10 * 60_000;
/** Tempo máximo esperando outro comando terminar. */
export const LOCK_WAIT_MS = 60_000;
