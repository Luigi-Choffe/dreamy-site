/**
 * Rate limit por chave (IP) — janela deslizante em memória (V1, ADR-011).
 * Em ambientes serverless multi-instância o limite é por instância; para limite
 * global, implemente `RateLimiter` com um store compartilhado (ex.: Upstash) e
 * troque em `createRateLimiter()`.
 */
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

let singleton: RateLimiter | null = null;

/** 5 envios por IP a cada 10 minutos. */
export function getLeadRateLimiter(): RateLimiter {
  if (!singleton) singleton = createMemoryRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });
  return singleton;
}
