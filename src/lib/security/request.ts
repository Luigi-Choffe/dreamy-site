import { randomUUID } from "node:crypto";

/** ID de request para correlação de logs (usa o do proxy/host quando existir). */
export function getRequestId(headers: Headers): string {
  return headers.get("x-request-id") ?? headers.get("x-vercel-id") ?? randomUUID();
}

/** IP do cliente atrás de proxies confiáveis (Vercel/Cloudflare) — usado só para rate limit. */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}
