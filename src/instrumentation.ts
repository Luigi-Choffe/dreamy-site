/**
 * Instrumentação do servidor Next.js (PRD §79 — observabilidade sem PII).
 *
 * `onRequestError` é chamado pelo Next para qualquer erro capturado no servidor
 * (renderização de Server Components, route handlers, actions, proxy). Aqui ele vira
 * uma linha de log estruturado (JSON) que qualquer host expõe (Vercel Logs, stdout do
 * Node, etc.). É o ponto único para plugar um error monitoring (Sentry, OTel) no futuro
 * — nenhuma dependência é adicionada antes disso.
 *
 * Regras: não logar headers (podem conter cookies/IP), nem query string (pode carregar
 * dados digitados); apenas método, path e contexto da rota.
 */
import type { Instrumentation } from "next";
import { reportServerError } from "@/lib/observability/logger";

export function register(): void {
  // Ponto de integração para OpenTelemetry/Sentry (`registerOTel`), quando/se configurado via env.
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : undefined;
  const path = request.path.split("?")[0] ?? request.path;
  reportServerError("server.request_error", error, {
    method: request.method,
    path,
    digest,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  });
};
