/**
 * Cliente mínimo para Redis via REST (Upstash / Vercel Marketplace), sem SDK (ADR-011).
 * Usado apenas pelo rate limit e pela idempotência do endpoint de leads quando um store
 * compartilhado está configurado; sem as variáveis, tudo continua em memória (por instância).
 *
 * Variáveis reconhecidas (qualquer par):
 * - KV_REST_API_URL + KV_REST_API_TOKEN (integração Upstash no Vercel Marketplace)
 * - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash direto)
 */
import { logger } from "@/lib/observability/logger";

export type KvArg = string | number;

export interface KvClient {
  /** Executa um comando (ex.: `cmd("INCR", "chave")`). Rejeita em erro HTTP/Redis. */
  cmd<T = unknown>(...args: KvArg[]): Promise<T>;
  /** Executa vários comandos em uma única viagem (sequencial, não transacional). */
  pipeline<T extends unknown[] = unknown[]>(commands: KvArg[][]): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 2000;

export function createUpstashKv(url: string, token: string, fetchImpl: typeof fetch = fetch): KvClient {
  const base = url.replace(/\/+$/, "");
  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`kv: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    async cmd<T>(...args: KvArg[]) {
      const data = await post<{ result?: T; error?: string }>("", args);
      if (data.error) throw new Error(`kv: ${data.error}`);
      return data.result as T;
    },
    async pipeline<T extends unknown[]>(commands: KvArg[][]) {
      const data = await post<Array<{ result?: unknown; error?: string }>>("/pipeline", commands);
      const failed = data.find((d) => d.error);
      if (failed) throw new Error(`kv: ${failed.error}`);
      return data.map((d) => d.result) as T;
    },
  };
}

let cached: KvClient | null | undefined;

/** Cliente configurado por env, ou `null` quando não há store compartilhado. */
export function getKvClient(): KvClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.KV_REST_API_URL?.trim() || process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim() || process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    cached = createUpstashKv(url, token);
    logger.info("kv.enabled", { provider: "upstash-rest" });
  } else {
    cached = null;
  }
  return cached;
}

/** Somente para testes. */
export function resetKvClientForTests() {
  cached = undefined;
}

export function kvErrorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
