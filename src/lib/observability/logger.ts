/**
 * Logger estruturado (PRD §79). Saída JSON em uma linha por evento.
 * Regra: nunca logar PII completa (nome, e-mail, telefone, descrição) exceto no
 * caminho de recuperação de última instância (todas as entregas falharam).
 */
type Level = "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, event: string, fields: LogFields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** Ponto único para integração futura de error monitoring (Sentry etc.), sem PII. */
export function reportServerError(event: string, error: unknown, fields: LogFields = {}) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  logger.error(event, { ...fields, error: message });
}
