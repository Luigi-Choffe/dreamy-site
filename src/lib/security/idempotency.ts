/**
 * Idempotência por submissionId (PRD §42): reenvio (double-click, refresh, retry)
 * dentro da janela devolve a resposta original em vez de criar lead duplicado.
 * Memória por instância (V1); trocar por store compartilhado se necessário.
 */
export interface IdempotencyStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  /** marca como "em andamento" para evitar corrida entre requisições simultâneas */
  reserve(key: string): boolean;
  release(key: string): void;
}

export function createMemoryIdempotencyStore<T>(ttlMs = 10 * 60 * 1000, now = Date.now): IdempotencyStore<T> {
  const done = new Map<string, { value: T; at: number }>();
  const pending = new Set<string>();

  function sweep() {
    const t = now();
    for (const [k, v] of done) if (t - v.at > ttlMs) done.delete(k);
  }

  return {
    get(key) {
      sweep();
      return done.get(key)?.value;
    },
    set(key, value) {
      done.set(key, { value, at: now() });
      pending.delete(key);
    },
    reserve(key) {
      if (pending.has(key)) return false;
      pending.add(key);
      return true;
    },
    release(key) {
      pending.delete(key);
    },
  };
}
