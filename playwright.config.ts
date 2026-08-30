import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * E2E (PRD §89): roda contra um build de produção local (next start) para refletir o comportamento real.
 * Use PLAYWRIGHT_BASE_URL para apontar para outro servidor.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SITE_ENV: "test",
          NODE_ENV: "production",
          // Auth do console interno (tests/e2e/outbound-console.spec.ts assina o cookie com o mesmo segredo).
          OUTBOUND_SESSION_SECRET: process.env.OUTBOUND_SESSION_SECRET ?? "e2e-secret-nao-use-em-producao",
          OUTBOUND_TEAM_EMAILS: "e2e@dreamy.test",
        },
      },
});
