/**
 * Salvaguarda da falha #19 (docs/FALHAS-E-SALVAGUARDAS.md): em 20/10 a rede do PC
 * estava ruim (TLS lento, DNS falhando) e o driver do Neon devolvia "fetch failed"
 * (UND_ERR_CONNECT_TIMEOUT); todo ciclo abortava no sync. Erro de rede antes da
 * resposta é transitório e se repete com espera; erro de SQL não.
 */
import { describe, expect, it } from "vitest";
import { isTransientNetworkError, withNetworkRetry } from "@/lib/outbound/sql";

function fetchFailed(code: string): Error {
  return new TypeError("fetch failed", { cause: Object.assign(new Error(code), { code }) });
}

describe("#19 isTransientNetworkError", () => {
  it("reconhece os erros de rede do fetch (código na causa) e o 'terminated' do socket", () => {
    expect(isTransientNetworkError(fetchFailed("UND_ERR_CONNECT_TIMEOUT"))).toBe(true);
    expect(isTransientNetworkError(fetchFailed("ECONNRESET"))).toBe(true);
    expect(isTransientNetworkError(fetchFailed("EAI_AGAIN"))).toBe(true);
    expect(isTransientNetworkError(new Error("terminated"))).toBe(true);
    expect(isTransientNetworkError(Object.assign(new Error("x"), { code: "ETIMEDOUT" }))).toBe(true);
  });
  it("não confunde erro de SQL com erro de rede", () => {
    expect(isTransientNetworkError(new Error('syntax error at or near "SELEC"'))).toBe(false);
    expect(isTransientNetworkError(new Error("duplicate key value violates unique constraint"))).toBe(false);
    expect(isTransientNetworkError("string")).toBe(false);
  });
});

describe("#19 withNetworkRetry", () => {
  it("repete em erro transitório e devolve o resultado quando a rede volta", async () => {
    let chamadas = 0;
    const tentativas: number[] = [];
    const r = await withNetworkRetry(
      async () => {
        chamadas += 1;
        if (chamadas < 3) throw fetchFailed("UND_ERR_CONNECT_TIMEOUT");
        return "ok";
      },
      { attempts: 4, baseMs: 1, onRetry: (a) => tentativas.push(a) },
    );
    expect(r).toBe("ok");
    expect(chamadas).toBe(3);
    expect(tentativas).toEqual([1, 2]);
  });
  it("desiste depois do número de tentativas e relança o último erro", async () => {
    let chamadas = 0;
    await expect(
      withNetworkRetry(
        async () => {
          chamadas += 1;
          throw fetchFailed("ECONNRESET");
        },
        { attempts: 3, baseMs: 1 },
      ),
    ).rejects.toThrow("fetch failed");
    expect(chamadas).toBe(3);
  });
  it("erro que não é de rede sobe na primeira tentativa, sem repetir", async () => {
    let chamadas = 0;
    await expect(
      withNetworkRetry(
        async () => {
          chamadas += 1;
          throw new Error("relation does not exist");
        },
        { attempts: 4, baseMs: 1 },
      ),
    ).rejects.toThrow("relation does not exist");
    expect(chamadas).toBe(1);
  });
});
