// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_COOKIE,
  CONSENT_HEAD_SCRIPT,
  applyConsent,
  readConsentCookie,
  saveConsent,
  writeConsentCookie,
} from "@/lib/consent/consent";

describe("consentimento (PRD §73) + Consent Mode v2", () => {
  afterEach(() => {
    document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/`;
    window.dataLayer = [];
    window.gtag = undefined;
  });

  it("grava e lê o cookie com versão; ignora versão desconhecida", () => {
    expect(readConsentCookie()).toBeNull();
    writeConsentCookie({ analytics: true, marketing: false });
    const saved = readConsentCookie();
    expect(saved).toMatchObject({ v: 1, analytics: true, marketing: false });
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ v: 99, analytics: true }))}; Path=/`;
    expect(readConsentCookie()).toBeNull();
  });

  it("applyConsent atualiza gtag, empilha consent_update e emite evento", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    window.dataLayer = [];
    const listener = vi.fn();
    window.addEventListener(CONSENT_CHANGE_EVENT, listener);
    applyConsent({ v: 1, analytics: true, marketing: false, t: 1 });
    expect(gtag).toHaveBeenCalledWith(
      "consent",
      "update",
      expect.objectContaining({
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      }),
    );
    expect(window.dataLayer!.find((e) => (e as { event: string }).event === "consent_update")).toMatchObject({
      consent_analytics: true,
      consent_marketing: false,
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(CONSENT_CHANGE_EVENT, listener);
  });

  it("saveConsent persiste + aplica; script inline define default denied e restaura escolha salva", () => {
    saveConsent({ analytics: false, marketing: true });
    expect(readConsentCookie()?.marketing).toBe(true);

    // executa o script do <head> num contexto isolado (window/document simulados)
    window.dataLayer = [];
    window.gtag = undefined;
    new Function("window", "document", CONSENT_HEAD_SCRIPT)(window, document);
    const dl = window.dataLayer as unknown as Array<ArrayLike<unknown>>;
    const def = dl.find(
      (e) => e && (e as ArrayLike<unknown>)[0] === "consent" && (e as ArrayLike<unknown>)[1] === "default",
    ) as ArrayLike<unknown> | undefined;
    expect(def).toBeTruthy();
    const params = def![2] as Record<string, string>;
    expect(params.analytics_storage).toBe("denied");
    expect(params.ad_storage).toBe("granted"); // restaurado do cookie salvo
    expect(params.wait_for_update).toBe(500);
  });
});
