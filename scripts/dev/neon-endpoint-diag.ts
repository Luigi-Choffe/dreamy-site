// Diagnóstico (falha #19): o driver do Neon manda as queries HTTP para o host regional
// `api.<região>.aws.neon.tech`; quando esse caminho está ruim, o host do próprio
// endpoint (o da connection string) também serve `/sql`. Compara os dois com o
// fetch resiliente. Só leitura (select 1). Uso: pnpm tsx scripts/dev/neon-endpoint-diag.ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { fetchResiliente } from "../../src/lib/outbound/http";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

async function tenta(nome: string, endpoint: typeof neonConfig.fetchEndpoint): Promise<void> {
  neonConfig.fetchFunction = fetchResiliente;
  neonConfig.fetchEndpoint = endpoint;
  const sql = neon(process.env.OUTBOUND_DATABASE_URL ?? "");
  const t0 = Date.now();
  try {
    const r = (await sql.query("select 1 as ok")) as Array<{ ok: number }>;
    console.log(`${nome}: ok=${r[0]?.ok} em ${Date.now() - t0} ms`);
  } catch (e) {
    const err = e as Error & { sourceError?: Error & { cause?: { code?: string } } };
    console.log(`${nome}: FALHOU em ${Date.now() - t0} ms (${err.sourceError?.cause?.code ?? err.message})`);
  }
}

async function main(): Promise<void> {
  const padrao = neonConfig.fetchEndpoint;
  await tenta("host regional (padrão do driver)", padrao);
  await tenta(
    "host do endpoint (connection string)",
    (host, port) => `https://${host}${port && port !== 443 ? `:${port}` : ""}/sql`,
  );
}

main();

export {};
