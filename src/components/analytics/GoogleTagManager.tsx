import Script from "next/script";
import { GTM_ID } from "@/config/env";
import { CONSENT_HEAD_SCRIPT } from "@/lib/consent/consent";

/**
 * Camada de tags (ADR-009): (1) consent default antes de qualquer tag;
 * (2) GTM carregado após hidratação, somente com NEXT_PUBLIC_GTM_ID.
 * GA4/Meta/LinkedIn são configurados DENTRO do container (docs/TRACKING.md).
 */
export function GoogleTagManager() {
  return (
    <>
      {/* Inline síncrono no <head>: garante consent default antes de qualquer tag. */}
      <script id="consent-default" dangerouslySetInnerHTML={{ __html: CONSENT_HEAD_SCRIPT }} />
      {GTM_ID ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}
    </>
  );
}

/** <noscript> do GTM — colocado no início do <body>. */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
