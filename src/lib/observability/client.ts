/**
 * Relato de erros no cliente (PRD §79). Sem PII. Se um serviço de error monitoring
 * for configurado (ex.: Sentry), integrar aqui — nenhuma dependência é adicionada antes disso.
 */
export function reportClientError(error: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.error("[client-error]", error);
    return;
  }
  // Ponto único de integração futura com error monitoring.
  console.error("[client-error]", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}
