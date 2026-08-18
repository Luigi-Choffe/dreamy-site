import { describe, expect, it } from "vitest";
import { absoluteUrl, createPageMetadata, robotsFor } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, organizationJsonLd, serviceJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";

describe("SEO helpers (PRD §47–§49, §53)", () => {
  it("absoluteUrl usa a URL canônica com www", () => {
    expect(absoluteUrl("/")).toBe("https://www.dreamy.app.br/");
    expect(absoluteUrl("/solucoes/agentes-de-ia")).toBe("https://www.dreamy.app.br/solucoes/agentes-de-ia");
    expect(absoluteUrl("sobre")).toBe("https://www.dreamy.app.br/sobre");
  });

  it("fora de produção tudo é noindex (preview/staging)", () => {
    const robots = robotsFor() as { index: boolean; follow: boolean };
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(false);
  });

  it("createPageMetadata gera title absoluto, canonical, OG e Twitter", () => {
    const m = createPageMetadata({
      title: "Agentes de IA para Empresas | Dreamy",
      description: "desc",
      path: "/solucoes/agentes-de-ia",
    });
    expect(m.title).toEqual({ absolute: "Agentes de IA para Empresas | Dreamy" });
    expect(m.alternates?.canonical).toBe("https://www.dreamy.app.br/solucoes/agentes-de-ia");
    expect((m.openGraph as { url?: string }).url).toBe("https://www.dreamy.app.br/solucoes/agentes-de-ia");
    expect((m.openGraph as { locale?: string }).locale).toBe("pt_BR");
    expect((m.twitter as { card?: string }).card).toBe("summary_large_image");
  });

  it("JSON-LD: Organization/WebSite/Service/Breadcrumb sem review/rating", () => {
    const org = organizationJsonLd();
    expect(org["@type"]).toBe("Organization");
    expect(JSON.stringify(org)).not.toMatch(/aggregateRating|review/i);
    expect(webSiteJsonLd()["@type"]).toBe("WebSite");
    const svc = serviceJsonLd({
      name: "Agentes de IA",
      description: "d",
      path: "/solucoes/agentes-de-ia",
      serviceType: "Agentes de IA",
    });
    expect(svc.provider).toEqual({ "@id": org["@id"] });
    const bc = breadcrumbJsonLd([
      { name: "Início", path: "/" },
      { name: "Soluções", path: "/solucoes" },
    ]);
    expect(bc.itemListElement).toHaveLength(2);
    expect(bc.itemListElement[1]).toMatchObject({ position: 2, item: "https://www.dreamy.app.br/solucoes" });
  });
});
