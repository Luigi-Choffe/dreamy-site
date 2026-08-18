# Dreamy — Site institucional B2B

Site institucional da Dreamy (software sob medida e agentes de IA para empresas), construído a partir do **PRD v2.0** (`docs/PRD.md` — fonte de verdade). Objetivo: gerar reuniões comerciais qualificadas.

**Três ofertas** (e somente três): Nova Receita Digital · Sistemas Sob Medida · Agentes de IA.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5.9 · Tailwind CSS 4 · Zod 4 (`zod/mini` no formulário) · MDX (`next-mdx-remote`) · Vitest + Testing Library · Playwright + axe-core · ESLint 9 · Prettier · pnpm 11.

Decisões e justificativas: `docs/DECISIONS.md` (ADRs). Arquitetura: `docs/ARCHITECTURE.md`.

## Requisitos

- Node.js ≥ 20.9 (testado com 24) · pnpm 11 (`npm i -g pnpm` ou `corepack enable`)
- Para E2E/Lighthouse: `pnpm exec playwright install chromium`

## Instalação e desenvolvimento

```bash
pnpm install
cp .env.example .env.local        # opcional — o site funciona sem variáveis
pnpm dev                          # http://localhost:3000
```

Página interna de revisão do design system (fora de produção): `http://localhost:3000/dev/design-system`.

Em desenvolvimento, leads enviados pelo formulário são gravados em `.leads/*.jsonl` (gitignored) quando nenhum CRM/e-mail está configurado.

## Build e produção

```bash
pnpm build
pnpm start                        # porta 3000
```

Preview/staging: sem `NEXT_PUBLIC_SITE_ENV=production` (opt-in explícito — não é inferido de `VERCEL_ENV`) o site inteiro sai como **noindex** (meta, robots.txt e header `X-Robots-Tag`) e o sitemap fica vazio.

## Scripts

| Script                                         | O que faz                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`       | desenvolvimento / build de produção / servidor de produção                                                             |
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | ESLint · `tsc --noEmit` · Prettier                                                                                     |
| `pnpm test` / `pnpm test:watch`                | unitários + componentes (Vitest, jsdom)                                                                                |
| `pnpm test:e2e` / `pnpm test:e2e:ui`           | Playwright (sobe `next start` em `:3100`; use `PLAYWRIGHT_BASE_URL` para outro alvo)                                   |
| `pnpm content:check`                           | integridade de conteúdo: schemas MDX, prova aprovada, termos proibidos/placeholders                                    |
| `pnpm qa:screenshots`                          | screenshots 390/768/1440 de todas as rotas + checagem de overflow/H1/console (`--base`, `--out`, `--routes`, `--full`) |
| `pnpm audit:screenshots`                       | screenshots do site atual (Fase 0)                                                                                     |
| `pnpm check`                                   | typecheck + lint + testes + build                                                                                      |

## Variáveis de ambiente

Todas opcionais (ver `.env.example`). Nunca commite valores reais.

| Variável                                                                                             | Uso                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                                                                               | URL canônica (padrão `https://www.dreamy.app.br`)                                                            |
| `NEXT_PUBLIC_SITE_ENV`                                                                               | `production` libera indexação; qualquer outro valor = noindex                                                |
| `NEXT_PUBLIC_GTM_ID`                                                                                 | carrega o GTM (única camada de tags; GA4/Meta/LinkedIn ficam dentro do container)                            |
| `CRM_PROVIDER` / `CRM_WEBHOOK_URL` / `CRM_API_KEY`                                                   | `webhook` envia `{ type: "lead.created", lead }` (JSON) com retry; `none` só registra log                    |
| `EMAIL_PROVIDER` / `EMAIL_PROVIDER_API_KEY` / `LEADS_NOTIFICATION_EMAIL` / `LEADS_NOTIFICATION_FROM` | notificação de lead por e-mail (`resend`)                                                                    |
| `NEXT_PUBLIC_BOOKING_URL`                                                                            | link de agendamento exibido após o envio                                                                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`                                            | Cloudflare Turnstile (opcional)                                                                              |
| `CSP_ENFORCE`                                                                                        | `true` aplica a CSP em enforce (padrão Report-Only)                                                          |
| `LEADS_DEV_STORE`                                                                                    | `false` desativa a gravação local em dev                                                                     |
| `CONTENT_PREVIEW`                                                                                    | `true` exibe cases não aprovados e insights em `review` (somente fora de produção; preview é sempre noindex) |

## CI

`.github/workflows/ci.yml`: typecheck → lint → prettier → content-check → unit → build, depois E2E (Playwright + axe) com relatório em artefato quando falhar.

## Deploy

Qualquer host Node/Next (recomendado: Vercel). Checklist completo: `docs/LAUNCH-CHECKLIST.md`. Checklist de produção e migração de domínio em `docs/SEO-MIGRATION.md`; lançamento em `docs/PRD.md` §108. Em produção: `NEXT_PUBLIC_SITE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.dreamy.app.br`, apex `dreamy.app.br` → 301 para `www` (host + `next.config.ts`).

## Analytics

GTM + Consent Mode v2 (banner próprio: necessário/analytics/marketing). Eventos do dataLayer e a configuração esperada no container estão em `docs/TRACKING.md`. Nenhuma PII entra no dataLayer (teste unitário garante).

## Conteúdo

- Copy das páginas: `src/content/*.ts` (literal do PRD; itens autorais listados em `docs/COPY-REVIEW.md`).
- Soluções: `src/content/solutions/*.ts` (exatamente três).
- Cases (`src/content/cases/*.mdx`) e Insights (`src/content/insights/*.mdx`): frontmatter validado por Zod. **Gates**: cases só publicam com `approved: true`; Insights só vai ao ar com ≥ 3 artigos `published`. Templates: `_TEMPLATE.mdx.example`. Três rascunhos de Insights (backlog do PRD §33) estão em `status: review` — revisar e mudar para `published` para publicar. Para revisar localmente: `CONTENT_PREVIEW=true pnpm dev`.
- Prova (métricas/logos): `src/content/proof.ts` — só entram com `verified`/`authorized` **e** registro em `docs/CONTENT-SOURCES.md`.
- Dados institucionais (contatos, CNPJ, redes): `src/config/site.ts` — valores ausentes são omitidos da UI (nunca inventar).

## Estrutura

```
.agents/rules/dreamy-site.md   regra always-on do workspace (Antigravity) — também referenciada em CLAUDE.md
docs/                          PRD, plano, arquitetura, ADRs, tracking, QA, migração SEO, auditoria, copy review
public/brand                   logo/símbolo (PNG oficiais otimizados)
scripts/                       screenshots (auditoria/QA), content-check, utilitários de dev
src/app                        rotas, metadata, OG images, sitemap/robots, API de leads, 404/erros
src/components                 ui · layout · marketing · diagrams · forms · content · analytics
src/config                     site (dados institucionais), navegação, env
src/content                    copy tipada, soluções, cases/insights (MDX), legal, prova
src/lib                        analytics · consent · leads (schema/scoring/service) · crm · email · security · seo · content · observability
src/styles                     tokens.css, fonts.ts
tests/                         unit · components · e2e
```

## Regras do projeto

Ver `.agents/rules/dreamy-site.md`. Em resumo: PRD é a fonte de verdade; nunca inventar clientes, métricas, depoimentos, cases; NoCode/LowCode nunca como posicionamento; exatamente três soluções; Server Components por padrão; acessibilidade, SEO e performance preservados; nada de PII em analytics; nenhuma fase concluída sem build, testes e revisão no browser.
