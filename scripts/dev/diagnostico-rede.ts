// Diagnóstico de rede do outbound (falha #19): compara o fetch global do Node com o
// fetch resiliente (IPv4 só, HTTP/2, 30 s) contra os três hosts que a operação usa.
// Só leitura; não envia nada. Uso: pnpm tsx scripts/dev/diagnostico-rede.ts
import { fetchResiliente } from "../../src/lib/outbound/http";

const ALVOS: Array<{ nome: string; url: string; method: "GET" | "POST" }> = [
  { nome: "Resend API", url: "https://api.resend.com/domains", method: "GET" },
  { nome: "Neon API (banco)", url: "https://api.c-10.us-east-1.aws.neon.tech/sql", method: "POST" },
  { nome: "site", url: "https://www.dreamy.app.br/", method: "GET" },
];

async function mede(nome: string, fn: () => Promise<{ status: number }>): Promise<void> {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`  ${nome}: ${r.status} em ${Date.now() - t0} ms`);
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    console.log(`  ${nome}: FALHOU em ${Date.now() - t0} ms (${err.cause?.code ?? err.message})`);
  }
}

async function main(): Promise<void> {
  for (const a of ALVOS) {
    const init = {
      method: a.method,
      headers: { "content-type": "application/json" },
      body: a.method === "POST" ? "{}" : undefined,
    };
    console.log(`${a.nome}`);
    await mede("fetch global", () => fetch(a.url, { ...init, signal: AbortSignal.timeout(40_000) }));
    await mede("fetch resiliente", () => fetchResiliente(a.url, init));
  }
}

main();

export {};
