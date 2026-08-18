// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ATTRIBUTION_KEY, captureAttribution, getAttribution, parseUtms } from "@/lib/analytics/attribution";
import { assertSafeEvent, track, trackCta } from "@/lib/analytics/events";

describe("dataLayer helpers (docs/TRACKING.md)", () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it("track empilha eventos permitidos", () => {
    track({ event: "cta_click", cta_id: "hero_primary", cta_location: "hero", page: "/", intent: "contact" });
    trackCta("x", "footer", "whatsapp");
    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer![0]).toMatchObject({ event: "cta_click", cta_id: "hero_primary" });
  });

  it("bloqueia eventos desconhecidos e parâmetros com PII", () => {
    expect(assertSafeEvent({ event: "purchase" })).toMatch(/não permitido/);
    expect(assertSafeEvent({ event: "generate_lead", email: "a@b.com" })).toMatch(/PII/);
    expect(assertSafeEvent({ event: "form_error", field: "email", error_type: "validation" })).toBeNull();
    expect(
      assertSafeEvent({
        event: "cta_click",
        cta_id: "joao@empresa.com",
        cta_location: "x",
        page: "/",
        intent: "contact",
      }),
    ).toMatch(/PII/);
    expect(() =>
      track({
        event: "generate_lead",
        solution: "sistema",
        lead_bucket: "alta",
        urgency_bucket: "ate_30d",
        email: "a@b.com",
      } as never),
    ).toThrow();
    expect(window.dataLayer).toHaveLength(0);
  });
});

describe("atribuição (PRD §45)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    document.cookie = `${ATTRIBUTION_KEY}=; Max-Age=0; Path=/`;
    document.cookie = "dreamy_consent=; Max-Age=0; Path=/";
  });

  it("parseUtms extrai apenas chaves utm_* e limita tamanho", () => {
    const utms = parseUtms("?utm_source=linkedin&utm_medium=social&foo=bar&utm_term=" + "x".repeat(400));
    expect(utms).toMatchObject({ utm_source: "linkedin", utm_medium: "social" });
    expect(utms.utm_term!.length).toBe(200);
    expect((utms as Record<string, string>).foo).toBeUndefined();
  });

  it("captura first-touch em sessionStorage e não usa cookie sem consentimento", () => {
    window.history.replaceState({}, "", "/solucoes?utm_source=google&utm_campaign=teste");
    const attr = captureAttribution();
    expect(attr?.utm_source).toBe("google");
    expect(attr?.landing_page).toBe("/solucoes?utm_source=google&utm_campaign=teste");
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBeTruthy();
    expect(document.cookie).not.toContain(ATTRIBUTION_KEY);
    // navegação interna sem UTM mantém a atribuição
    window.history.replaceState({}, "", "/contato");
    const again = captureAttribution();
    expect(again?.utm_source).toBe("google");
    expect(getAttribution().utm_campaign).toBe("teste");
  });

  it("persiste em cookie quando há consentimento de analytics", () => {
    document.cookie = `dreamy_consent=${encodeURIComponent(JSON.stringify({ v: 1, analytics: true, marketing: false, t: 1 }))}; Path=/`;
    window.history.replaceState({}, "", "/?utm_source=meta");
    captureAttribution();
    expect(document.cookie).toContain(ATTRIBUTION_KEY);
  });
});
