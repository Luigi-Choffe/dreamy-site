/**
 * Idempotência por submissionId (PRD §42): reenvio (double-click, refresh, retry)
 * dentro da janela devolve a resposta original em vez de criar lead duplicado.
 * - Memória por instância por padrão.
 * - Store compartilhado (Redis REST) quando configurado (ver `kv.ts`); falha do store = fail-open
 *   (o envio segue; no pior caso o CRM recebe um duplicado, nunca um lead perdido).
 */
import { logger } from "@/lib/observability/logger";
import { getKvClient, kvErrorMessage, type KvClient } from "@/lib/security/kv";

export interface IdempotencyStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  /** marca como "em andamento" para evitar corrida entre requisições simultâneas */
  reserve(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
}

export const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
/** Reserva "em andamento" expira sozinha (proteção contra instância que morre no meio). */
export const PENDING_TTL_MS = 60 * 1000;

export function createMemoryIdempotencyStore<T>(ttlMs = IDEMPOTENCY_TTL_MS, now = Date.now): IdempotencyStore<T> {
  const done = new Map<string, { value: T; at: number }>();
  const pending = new Map<string, number>();

  function sweep() {
    const t = now();
    for (const [k, v] of done) if (t - v.at > ttlMs) done.delete(k);
    for (const [k, at] of pending) if (t - at > PENDING_TTL_MS) pending.delete(k);
  }

  return {
    async get(key) {
      sweep();
      return done.get(key)?.value;
    },
    async set(key, value) {
      done.set(key, { value, at: now() });
      pending.delete(key);
    },
    async reserve(key) {
      sweep();
      if (pending.has(key)) return false;
      pending.set(key, now());
      return true;
    },
    async release(key) {
      pending.delete(key);
    },
  };
}

interface KvOptions {
  kv: KvClient;
  ttlMs?: number;
  prefix?: string;
}

export function createKvIdempotencyStore<T>({
  kv,
  ttlMs = IDEMPOTENCY_TTL_MS,
  prefix = "dreamy:idem",
}: KvOptions): IdempotencyStore<T> {
  const doneKey = (k: string) => `${prefix}:done:${k}`;
  const pendingKey = (k: string) => `${prefix}:pending:${k}`;
  const warn = (op: string, err: unknown) =>
    logger.warn("kv.idempotency_unavailable", { op, error: kvErrorMessage(err) });

  return {
    async get(key) {
      try {
        const raw = await kv.cmd<string | null>("GET", doneKey(key));
        return raw ? (JSON.parse(raw) as T) : undefined;
      } catch (err) {
        warn("get", err);
        return undefined;
      }
    },
    async set(key, value) {
      try {
        await kv.pipeline([
          ["SET", doneKey(key), JSON.stringify(value), "PX", ttlMs],
          ["DEL", pendingKey(key)],
        ]);
      } catch (err) {
        warn("set", err);
      }
    },
    async reserve(key) {
      try {
        const res = await kv.cmd<string | null>("SET", pendingKey(key), 1, "NX", "PX", PENDING_TTL_MS);
        return res === "OK";
      } catch (err) {
        warn("reserve", err);
        return true;
      }
    },
    async release(key) {
      try {
        await kv.cmd("DEL", pendingKey(key));
      } catch (err) {
        warn("release", err);
      }
    },
  };
}

let singleton: IdempotencyStore<unknown> | null = null;

/** Store do endpoint de leads (compartilhado se houver Redis configurado). */
export function getLeadIdempotencyStore<T>(): IdempotencyStore<T> {
  if (!singleton) {
    const kv = getKvClient();
    singleton = kv ? createKvIdempotencyStore<unknown>({ kv }) : createMemoryIdempotencyStore<unknown>();
  }
  return singleton as IdempotencyStore<T>;
}
