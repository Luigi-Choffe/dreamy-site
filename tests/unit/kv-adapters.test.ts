import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpstashKv, getKvClient, resetKvClientForTests, type KvArg, type KvClient } from "@/lib/security/kv";
import { createKvIdempotencyStore, PENDING_TTL_MS } from "@/lib/security/idempotency";
import { createKvRateLimiter } from "@/lib/security/rate-limit";

/** Redis fake: só os comandos usados pelos adapters (SET NX/PX, INCR, PTTL, GET, DEL), com relógio injetável. */
function fakeRedis(clock: { now: number }) {
  const data = new Map<string, { value: string; expiresAt: number | null }>();
  const calls: KvArg[][] = [];
  let failing: string | null = null;

  function alive(key: string) {
    const e = data.get(key);
    if (!e) return undefined;
    if (e.expiresAt !== null && e.expiresAt <= clock.now) {
      data.delete(key);
      return undefined;
    }
    return e;
  }

  function exec(args: KvArg[]): unknown {
    calls.push(args);
    if (failing) throw new Error(failing);
    const [cmd, key, ...rest] = args as [string, string, ...KvArg[]];
    switch (cmd) {
      case "SET": {
        const nx = rest.includes("NX");
        const pxIdx = rest.indexOf("PX");
        const px = pxIdx >= 0 ? Number(rest[pxIdx + 1]) : null;
        if (nx && alive(key)) return null;
        data.set(key, { value: String(rest[0]), expiresAt: px === null ? null : clock.now + px });
        return "OK";
      }
      case "INCR": {
        const e = alive(key);
        const next = (e ? Number(e.value) : 0) + 1;
        data.set(key, { value: String(next), expiresAt: e?.expiresAt ?? null });
        return next;
      }
      case "PTTL": {
        const e = alive(key);
        if (!e) return -2;
        return e.expiresAt === null ? -1 : e.expiresAt - clock.now;
      }
      case "GET":
        return alive(key)?.value ?? null;
      case "DEL":
        return data.delete(key) ? 1 : 0;
      default:
        throw new Error(`comando não suportado: ${cmd}`);
    }
  }

  const client: KvClient = {
    async cmd(...args) {
      return exec(args) as never;
    },
    async pipeline(commands) {
      return commands.map(exec) as never;
    },
  };
  return {
    client,
    calls,
    data,
    fail(message: string | null) {
      failing = message;
    },
  };
}

describe("createUpstashKv (REST, sem SDK)", () => {
  it("envia comando como JSON com Bearer token e devolve result", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe("https://kv.example.com");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
      expect(JSON.parse(String(init?.body))).toEqual(["INCR", "k"]);
      return new Response(JSON.stringify({ result: 3 }), { status: 200 });
    });
    const kv = createUpstashKv("https://kv.example.com/", "tok", fetchImpl as unknown as typeof fetch);
    expect(await kv.cmd<number>("INCR", "k")).toBe(3);
  });

  it("pipeline usa /pipeline e propaga erro de qualquer comando", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://kv.example.com/pipeline");
      return new Response(JSON.stringify([{ result: "OK" }, { error: "WRONGTYPE" }]), { status: 200 });
    });
    const kv = createUpstashKv("https://kv.example.com", "tok", fetchImpl as unknown as typeof fetch);
    await expect(
      kv.pipeline([
        ["SET", "a", 1],
        ["INCR", "a"],
      ]),
    ).rejects.toThrow(/WRONGTYPE/);
  });

  it("erro HTTP vira exceção (adapters tratam como fail-open)", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));
    const kv = createUpstashKv("https://kv.example.com", "tok", fetchImpl as unknown as typeof fetch);
    await expect(kv.cmd("GET", "a")).rejects.toThrow(/HTTP 401/);
  });
});

describe("getKvClient (env)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetKvClientForTests();
  });

  it("sem variáveis → null (memória por instância)", () => {
    resetKvClientForTests();
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(getKvClient()).toBeNull();
  });

  it("aceita KV_REST_API_* ou UPSTASH_REDIS_REST_*", () => {
    resetKvClientForTests();
    vi.stubEnv("KV_REST_API_URL", "https://kv.example.com");
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    expect(getKvClient()).not.toBeNull();
    resetKvClientForTests();
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://up.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    expect(getKvClient()).not.toBeNull();
  });
});

describe("createKvRateLimiter (janela fixa global)", () => {
  it("bloqueia acima do limite, informa retry-after e libera quando a chave expira", async () => {
    const clock = { now: 1_000 };
    const redis = fakeRedis(clock);
    const rl = createKvRateLimiter({ limit: 2, windowMs: 10_000, kv: redis.client });
    expect((await rl.check("ip")).allowed).toBe(true);
    expect((await rl.check("ip")).allowed).toBe(true);
    const third = await rl.check("ip");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBe(10);
    // outra chave não é afetada
    expect((await rl.check("outro-ip")).allowed).toBe(true);
    clock.now += 10_001;
    expect((await rl.check("ip")).allowed).toBe(true);
    // a chave sempre nasce com TTL (SET NX PX antes do INCR)
    expect(redis.calls[0]).toEqual(["SET", "dreamy:rl:ip", 0, "NX", "PX", 10_000]);
  });

  it("indisponibilidade do store = fail-open (não bloqueia leads)", async () => {
    const clock = { now: 0 };
    const redis = fakeRedis(clock);
    redis.fail("ECONNRESET");
    const rl = createKvRateLimiter({ limit: 1, windowMs: 1_000, kv: redis.client });
    expect((await rl.check("ip")).allowed).toBe(true);
    expect((await rl.check("ip")).allowed).toBe(true);
  });
});

describe("createKvIdempotencyStore", () => {
  it("reserva com NX, guarda a resposta com TTL e libera a reserva ao gravar", async () => {
    const clock = { now: 0 };
    const redis = fakeRedis(clock);
    const store = createKvIdempotencyStore<{ ok: boolean }>({ kv: redis.client, ttlMs: 5_000 });
    expect(await store.reserve("s1")).toBe(true);
    expect(await store.reserve("s1")).toBe(false); // corrida
    await store.set("s1", { ok: true });
    expect(await store.get("s1")).toEqual({ ok: true });
    expect(await store.reserve("s1")).toBe(true); // pending removido pelo set
    await store.release("s1");
    clock.now += 5_001;
    expect(await store.get("s1")).toBeUndefined(); // TTL da resposta
  });

  it("reserva expira sozinha após PENDING_TTL_MS", async () => {
    const clock = { now: 0 };
    const redis = fakeRedis(clock);
    const store = createKvIdempotencyStore<{ ok: boolean }>({ kv: redis.client });
    expect(await store.reserve("s2")).toBe(true);
    clock.now += PENDING_TTL_MS + 1;
    expect(await store.reserve("s2")).toBe(true);
  });

  it("indisponibilidade do store = fail-open (segue o envio, sem cache)", async () => {
    const clock = { now: 0 };
    const redis = fakeRedis(clock);
    redis.fail("timeout");
    const store = createKvIdempotencyStore<{ ok: boolean }>({ kv: redis.client });
    expect(await store.get("x")).toBeUndefined();
    expect(await store.reserve("x")).toBe(true);
    await expect(store.set("x", { ok: true })).resolves.toBeUndefined();
    await expect(store.release("x")).resolves.toBeUndefined();
  });
});
