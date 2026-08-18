/**
 * Rate limit por chave (IP) — PRD §75, ADR-011.
 * - Memória (janela deslizante) por padrão: em serverless multi-instância o limite é por instância.
 * - Store compartilhado (Redis REST — Upstash/Vercel Marketplace) quando `KV_REST_API_URL`/`KV_REST_API_TOKEN`
 *   (ou `UPSTASH_REDIS_REST_*`) existirem: janela fixa global. Falha do store = fail-open (lead nunca é
 *   bloqueado por indisponibilidade do Redis; fica registrado em log).
 */
import { logger } from "@/lib/observability/logger";
import { getKvClient, kvErrorMessage, type KvClient } from "@/lib/security/kv";

export interface RateLimiter {
  check(key: string): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }>;
}

interface Options {
  /** máximo de requisições na janela */
  limit: number;
  /** janela em ms */
  windowMs: number;
  now?: () => number;
}

export function createMemoryRateLimiter({ limit, windowMs, now = Date.now }: Options): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  function sweep(t: number) {
    if (t - lastSweep < windowMs) return;
    lastSweep = t;
    for (const [k, arr] of hits) {
      const kept = arr.filter((ts) => t - ts < windowMs);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
  }

  return {
    async check(key) {
      const t = now();
      sweep(t);
      const arr = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
      if (arr.length >= limit) {
        const oldest = arr[0]!;
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil((windowMs - (t - oldest)) / 1000)),
        };
      }
      arr.push(t);
      hits.set(key, arr);
      return { allowed: true, remaining: limit - arr.length, retryAfterSec: 0 };
    },
  };
}

interface KvOptions extends Omit<Options, "now"> {
  kv: KvClient;
  prefix?: string;
}

/**
 * Janela fixa em Redis: `SET k 0 NX PX janela` (garante TTL antes de contar) → `INCR k` → `PTTL k`,
 * em uma única viagem (pipeline). Chaves expiram sozinhas.
 */
export function createKvRateLimiter({ limit, windowMs, kv, prefix = "dreamy:rl" }: KvOptions): RateLimiter {
  return {
    async check(key) {
      const k = `${prefix}:${key}`;
      try {
        const [, count, ttl] = await kv.pipeline<[unknown, number, number]>([
          ["SET", k, 0, "NX", "PX", windowMs],
          ["INCR", k],
          ["PTTL", k],
        ]);
        if (count > limit) {
          const msLeft = ttl > 0 ? ttl : windowMs;
          return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(msLeft / 1000)) };
        }
        return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSec: 0 };
      } catch (err) {
        logger.warn("kv.rate_limit_unavailable", { error: kvErrorMessage(err) });
        return { allowed: true, remaining: limit, retryAfterSec: 0 };
      }
    },
  };
}

const LEAD_LIMIT = 5;
const LEAD_WINDOW_MS = 10 * 60 * 1000;

let singleton: RateLimiter | null = null;

/** 5 envios por IP a cada 10 minutos (global se houver store compartilhado). */
export function getLeadRateLimiter(): RateLimiter {
  if (!singleton) {
    const kv = getKvClient();
    singleton = kv
      ? createKvRateLimiter({ limit: LEAD_LIMIT, windowMs: LEAD_WINDOW_MS, kv })
      : createMemoryRateLimiter({ limit: LEAD_LIMIT, windowMs: LEAD_WINDOW_MS });
  }
  return singleton;
}
