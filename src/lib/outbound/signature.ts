/**
 * Assinatura ÚNICA dos e-mails de outbound — anexada pelo motor (buildEmail),
 * nunca escrita na copy das campanhas. Centraliza identidade + obrigação legal
 * (LGPD/PRD §18): mudou o remetente/cargo/contato, muda aqui e vale para tudo.
 *
 * Dados definidos pelo usuário em 2026-08-27: Luigi Choffe, Sócio fundador,
 * contact@bedreamy.com.br, WhatsApp +55 11 94879-3233, logo do site publicado.
 */

export const SIGNATURE = {
  nome: "Luigi Choffe",
  cargo: "Sócio fundador",
  marca: "Dreamy",
  site: "dreamy.app.br",
  siteUrl: "https://www.dreamy.app.br",
  email: "contact@bedreamy.com.br",
  whatsappDisplay: "+55 11 94879-3233",
  whatsappUrl: "https://wa.me/5511948793233",
  legal: "Metrifique.se · CNPJ 58.522.033/0001-81",
  /** Hospedado no próprio domínio do site (cache imutável) — versão para fundo claro. */
  logoUrl: "https://www.dreamy.app.br/brand/dreamy-logo-sm.png",
} as const;

/** Parte texto — sem URLs http (o 1º toque vai sem link; o domínio nu não é link) e sem travessão. */
export const SIGNATURE_TEXT = `${SIGNATURE.nome}
${SIGNATURE.cargo} · ${SIGNATURE.marca} · ${SIGNATURE.site}
${SIGNATURE.email} · WhatsApp ${SIGNATURE.whatsappDisplay}
${SIGNATURE.legal}`;

/**
 * Parte HTML — e-mail-safe (tabela + estilos inline; nada de flex/css externo).
 * SEM imagem: webmails bloqueiam imagem remota de remetente novo e a assinatura
 * aparecia quebrada (decisão do usuário, 2026-08-29). A marca é o wordmark em
 * texto com o disco verde tipográfico, que renderiza em qualquer cliente.
 */
export function signatureHtml(): string {
  const s = SIGNATURE;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-collapse:collapse">
<tr><td style="border-left:2px solid #46eb7e;padding:2px 0 2px 14px">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;margin:0 0 6px"><span style="color:#46eb7e;font-size:13px">&#9679;</span>&nbsp;<a href="${s.siteUrl}" style="color:#0b0b0c;text-decoration:none;font-weight:bold;letter-spacing:0.2px">${s.marca}</a></div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0b0b0c;font-weight:bold">${s.nome}</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5c6660">${s.cargo} · ${s.marca}</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6">
<a href="mailto:${s.email}" style="color:#0f7c47;text-decoration:none">${s.email}</a>
<span style="color:#5c6660">&nbsp;·&nbsp;</span>
<a href="${s.whatsappUrl}" style="color:#0f7c47;text-decoration:none">WhatsApp ${s.whatsappDisplay}</a>
</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8a938d">${s.legal}</div>
</td></tr>
</table>`;
}
