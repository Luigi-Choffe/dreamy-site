/**
 * Acesso SQL mínimo para o store hospedado (ADR-023): Postgres gerenciado (Neon)
 * via HTTP em produção; Postgres embutido (pglite) nos testes. Zero ORM — o
 * store persiste documentos JSONB por coleção, com a MESMA semântica do store
 * em arquivos (leitura/gravação de coleção inteira), o que mantém a migração
 * trivial nos dois sentidos.
 */

import { neon } from "@neondatabase/serverless";

export interface SqlStatement {
  text: string;
  params?: unknown[];
}

export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Executa as instruções atomicamente (tudo ou nada). */
  transaction(statements: SqlStatement[]): Promise<void>;
}

/** Cliente Neon (HTTP, sem sockets — funciona em serverless e no CLI local). */
export function createNeonSqlClient(databaseUrl: string): SqlClient {
  const sql = neon(databaseUrl);
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      return (await sql.query(text, params as never[])) as T[];
    },
    async transaction(statements) {
      if (statements.length === 0) return;
      // `sql.query` devolve uma query preguiçosa; `transaction` executa todas numa transação.
      const queries = statements.map((s) => sql.query(s.text, (s.params ?? []) as never[]));
      await sql.transaction(queries as never);
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
