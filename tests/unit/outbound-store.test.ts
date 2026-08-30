import { mkdtempSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openStore, runExclusive } from "../../src/lib/outbound/store";

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "outbound-store-"));
}

describe("openStore", () => {
  it("supressão é idempotente e normaliza o e-mail", async () => {
    const store = openStore(tempDir());
    expect(await store.suppress({ email: "  Maria@ACME.com.br ", reason: "manual" })).toBe(true);
    expect(await store.suppress({ email: "maria@acme.com.br", reason: "unsubscribe" })).toBe(false);
    const rows = await store.suppressions();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("maria@acme.com.br");
    expect(rows[0]?.reason).toBe("manual"); // o primeiro motivo prevalece
    expect(await store.isSuppressed("MARIA@acme.com.br")).toBe(true);
  });

  it("appendEvent deduplica por sourceKey", async () => {
    const store = openStore(tempDir());
    const draft = {
      sendId: "s1",
      campaignSlug: "c",
      type: "delivered" as const,
      sourceKey: "sync:abc:delivered",
      occurredAt: "2026-09-01T12:00:00Z",
    };
    expect(await store.appendEvent(draft)).toBe(true);
    expect(await store.appendEvent(draft)).toBe(false);
    expect(await store.events()).toHaveLength(1);
  });

  it("state tem default seguro (desarmado) e faz roundtrip", async () => {
    const store = openStore(tempDir());
    expect((await store.state()).armed).toBe(false);
    await store.saveState({ armed: true, armedAt: "2026-09-01T12:00:00Z" });
    expect((await store.state()).armed).toBe(true);
  });
});

describe("runExclusive", () => {
  it("cria e remove o lock em volta do trabalho", async () => {
    const dir = tempDir();
    const lockPath = path.join(dir, ".lock");
    const result = await runExclusive(
      "teste",
      async () => {
        expect(existsSync(lockPath)).toBe(true);
        return 42;
      },
      dir,
    );
    expect(result).toBe(42);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("remove o lock mesmo quando o trabalho lança", async () => {
    const dir = tempDir();
    await expect(
      runExclusive(
        "teste",
        async () => {
          throw new Error("boom");
        },
        dir,
      ),
    ).rejects.toThrow("boom");
    expect(existsSync(path.join(dir, ".lock"))).toBe(false);
  });

  it("rouba lock órfão (mais de 10 min, processo morto)", async () => {
    const dir = tempDir();
    const lockPath = path.join(dir, ".lock");
    writeFileSync(lockPath, JSON.stringify({ pid: 99999, label: "morto" }), "utf8");
    const old = new Date(Date.now() - 11 * 60_000);
    utimesSync(lockPath, old, old);
    const result = await runExclusive("teste", async () => "ok", dir);
    expect(result).toBe("ok");
    expect(existsSync(lockPath)).toBe(false);
  });
});

describe("openStore — seleção por env", () => {
  it("dir explícito força o store em arquivos mesmo com OUTBOUND_DATABASE_URL definida", async () => {
    const prev = process.env.OUTBOUND_DATABASE_URL;
    process.env.OUTBOUND_DATABASE_URL = "postgres://user:pass@example.invalid/db";
    try {
      const { openStore: open } = await import("../../src/lib/outbound/store");
      const dir = tempDir();
      const store = open(dir);
      expect(store.dir).toBe(dir);
      await store.saveState({ armed: true });
      expect((await store.state()).armed).toBe(true); // roundtrip em arquivo, sem tocar rede
    } finally {
      if (prev === undefined) delete process.env.OUTBOUND_DATABASE_URL;
      else process.env.OUTBOUND_DATABASE_URL = prev;
    }
  });
});
