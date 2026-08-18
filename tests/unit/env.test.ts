import { afterEach, describe, expect, it, vi } from "vitest";

/** ADR-017: produção é opt-in explícito; um deploy da Vercel em *.vercel.app nunca pode sair indexável. */
describe("IS_PRODUCTION_SITE (ADR-017, PRD §53)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load() {
    vi.resetModules();
    return import("@/config/env");
  }

  it("não é inferido de VERCEL_ENV / NEXT_PUBLIC_VERCEL_ENV", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ENV", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    const { IS_PRODUCTION_SITE } = await load();
    expect(IS_PRODUCTION_SITE).toBe(false);
  });

  it("liga apenas com NEXT_PUBLIC_SITE_ENV=production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ENV", "production");
    const { IS_PRODUCTION_SITE } = await load();
    expect(IS_PRODUCTION_SITE).toBe(true);
  });

  it("valores como preview/staging/test continuam fora de produção", async () => {
    for (const value of ["preview", "staging", "test", "ci", "development"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_ENV", value);
      const { IS_PRODUCTION_SITE } = await load();
      expect(IS_PRODUCTION_SITE, value).toBe(false);
    }
  });

  it("SITE_URL normaliza para a origem e cai no padrão www quando inválida", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example.com/qualquer/caminho");
    expect((await load()).SITE_URL).toBe("https://preview.example.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "nao-e-url");
    expect((await load()).SITE_URL).toBe("https://www.dreamy.app.br");
  });
});
