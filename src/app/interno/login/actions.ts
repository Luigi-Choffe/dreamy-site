"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { LOGIN_PATH, safeNextPath, sendLoginLink } from "@/lib/outbound/auth";
import { getClientIp } from "@/lib/security/request";

/** Origem pública da request (Next já exige Origin == Host em Server Functions). */
function requestOrigin(h: Headers): string {
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Pede o link de acesso. O envio roda DEPOIS da resposta (`after`): o tempo de
 * resposta é o mesmo para e-mail autorizado ou não, e a página já volta com a
 * mensagem única (`?sent=1`) — nunca revela se o e-mail está na lista.
 */
export async function requestLoginLinkAction(formData: FormData): Promise<void> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";
  const rawNext = formData.get("next");
  const next = safeNextPath(typeof rawNext === "string" ? rawNext : null);

  const h = await headers();
  const origin = requestOrigin(h);
  const ip = getClientIp(h);
  after(() => sendLoginLink(email, origin, { next, ip }));

  const params = new URLSearchParams({ sent: "1" });
  if (next) params.set("next", next);
  redirect(`${LOGIN_PATH}?${params.toString()}`);
}
