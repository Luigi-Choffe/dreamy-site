/**
 * Acesso SQL mínimo para o store hospedado (ADR-023): Postgres gerenciado (Neon)
 * via HTTP em produção; Postgres embutido (pglite) nos testes. Zero ORM — o
 * store persiste documentos JSONB por coleção, com a MESMA semântica do store
 * em arquivos (leitura/gravação de coleção inteira), o que mantém a migração
 * trivial nos dois sentidos.
 */

import { neon, neonConfig } from "@neondatabase/serverless";
import { fetchResiliente } from "./http";

export interface SqlStatement {
  text: string;
  params?: unknown[];
}

export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Executa as instruções atomicamente (tudo ou nada). */
  transaction(statements: SqlStatement[]): Promise<void>;
}

/**
 * Falha #19 (2026-10-20): numa rede ruim (handshake TLS de 2 a 14 s, DNS lento) o
 * fetch do driver estoura o connect timeout e o ciclo inteiro abortava no sync.
 * Erros de REDE antes de uma resposta são transitórios e seguros de repetir: as
 * gravações do store são upserts de coleção inteira, os eventos têm dedupe por
 * sourceKey e o lock é condicional. Erros de SQL (sintaxe, constraint) não entram.
 */
const TRANSIENT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
]);

export function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  if (cause?.code && TRANSIENT_CODES.has(cause.code)) return true;
  const code = (err as Error & { code?: string }).code;
  if (code && TRANSIENT_CODES.has(code)) return true;
  const msg = `${err.message} ${cause?.message ?? ""}`.toLowerCase();
  return msg.includes("fetch failed") || msg.includes("terminated") || msg.includes("socket hang up");
}

export const SQL_RETRY = { attempts: 6, baseMs: 2000 } as const;

/** Repete `fn` em erro transitório de rede com espera crescente (2 · 4 · 8 · 16 · 32 s: aguenta ~1 min de rede ruim). */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; onRetry?: (attempt: number, err: unknown) => void } = {},
): Promise<T> {
  const attempts = opts.attempts ?? SQL_RETRY.attempts;
  const baseMs = opts.baseMs ?? SQL_RETRY.baseMs;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isTransientNetworkError(err)) throw err;
      opts.onRetry?.(attempt, err);
      await new Promise((resolve) => setTimeout(resolve, baseMs * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

/** Cliente Neon (HTTP, sem sockets — funciona em serverless e no CLI local). */
export function createNeonSqlClient(databaseUrl: string): SqlClient {
  // O driver fala HTTP com `api.<região>.aws.neon.tech`; o fetch global do Node
  // travava na resolução AAAA desta rede (falha #19). Fetch próprio: IPv4, h2, 30 s.
  neonConfig.fetchFunction = fetchResiliente;
  const sql = neon(databaseUrl);
  const onRetry = (attempt: number, err: unknown) => {
    const cause = (err as Error & { cause?: { code?: string } }).cause?.code ?? (err as Error).message;
    console.warn(`  (banco: falha de rede transitória "${cause}", tentativa ${attempt + 1} de ${SQL_RETRY.attempts})`);
  };
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      return withNetworkRetry(async () => (await sql.query(text, params as never[])) as T[], { onRetry });
    },
    async transaction(statements) {
      if (statements.length === 0) return;
      // `sql.query` devolve uma query preguiçosa; `transaction` executa todas numa transação.
      // A transação é atômica no servidor: se a conexão caiu antes da resposta, ou
      // nada foi aplicado ou tudo foi (e repetir um upsert de coleção é idempotente).
      await withNetworkRetry(
        async () => {
          const queries = statements.map((s) => sql.query(s.text, (s.params ?? []) as never[]));
          await sql.transaction(queries as never);
        },
        { onRetry },
      );
    },
  };
}

/** Adapter para uma instância PGlite (testes) ou qualquer objeto com a mesma API. */
export interface PgliteLike {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(
    fn: (tx: { query<R>(text: string, params?: unknown[]): Promise<{ rows: R[] }> }) => Promise<T>,
  ): Promise<T>;
}

export function createPgliteSqlClient(db: PgliteLike): SqlClient {
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      return (await db.query<T>(text, params)).rows;
    },
    async transaction(statements) {
      await db.transaction(async (tx) => {
        for (const s of statements) await tx.query(s.text, s.params ?? []);
      });
    },
  };
}

/** DDL idempotente — `pnpm outbound:db migrate` e os testes chamam a cada início. */
export const SCHEMA_SQL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS outbound_documents (
     seq bigserial,
     collection text NOT NULL,
     id text NOT NULL,
     data jsonb NOT NULL,
     PRIMARY KEY (collection, id)
   )`,
  `CREATE INDEX IF NOT EXISTS outbound_documents_seq ON outbound_documents (collection, seq)`,
  `CREATE TABLE IF NOT EXISTS outbound_events (
     seq bigserial PRIMARY KEY,
     id text NOT NULL,
     source_key text NOT NULL UNIQUE,
     data jsonb NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS outbound_state (
     id smallint PRIMARY KEY,
     data jsonb NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS outbound_locks (
     name text PRIMARY KEY,
     holder text NOT NULL,
     expires_at timestamptz NOT NULL
   )`,
];

export async function ensureSchema(client: SqlClient): Promise<void> {
  for (const ddl of SCHEMA_SQL) await client.query(ddl);
}
