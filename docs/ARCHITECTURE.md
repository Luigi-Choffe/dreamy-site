# Arquitetura — Dreamy Site

## 1. Stack

| Camada          | Escolha                                                          | Versão | Observação                                                                           |
| --------------- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Framework       | Next.js (App Router, Turbopack)                                  | 16.3   | Server Components por padrão; Metadata API; `sitemap.ts`/`robots.ts`; Route Handlers |
| UI              | React                                                            | 19.2   |                                                                                      |
| Linguagem       | TypeScript (strict)                                              | 5.9    | TS 7 ainda sem suporte no typescript-eslint (ADR-002)                                |
| Estilo          | Tailwind CSS v4 (CSS-first, `@theme`)                            | 4.3    | Tokens em `src/styles/tokens.css`                                                    |
| Motion          | `motion` (`motion/react`, `LazyMotion` + `m`)                    | 13.1   | Reveals, stagger, line drawing; respeita `prefers-reduced-motion`                    |
| Validação       | Zod                                                              | 4.4    | Schemas compartilhados client/server (`src/lib/validation`)                          |
| Conteúdo        | MDX (`next-mdx-remote/rsc`) + `gray-matter` + Zod                | —      | Cases e Insights em `src/content/`; Soluções como objetos TS tipados                 |
| Ícones          | `lucide-react`                                                   | 1.x    | tree-shaken                                                                          |
| Testes          | Vitest + Testing Library · Playwright + axe-core                 | —      | `tests/unit`, `tests/components`, `tests/e2e`                                        |
| Qualidade       | ESLint (flat, `eslint-config-next`) · Prettier + plugin Tailwind | —      |                                                                                      |
| Pacotes         | pnpm                                                             | 11     |                                                                                      |
| Hospedagem alvo | Vercel (ou qualquer host Node)                                   | —      | Tudo é `noindex` até `NEXT_PUBLIC_SITE_ENV=production` (opt-in explícito, ADR-017)   |

## 2. Estrutura de pastas

```
.agents/rules/dreamy-site.md   regra always-on (Antigravity)
docs/                          PRD, plano, ADRs, tracking, QA, migração SEO, auditoria
public/brand|images|icons      assets estáticos (logo, símbolo, OG fallback)
scripts/                       utilitários (screenshots de auditoria/QA, content check)
src/app/                       rotas (App Router), metadata, sitemap, robots, OG images, API
src/components/ui              primitivos (Button, Input, Card, Accordion, Dialog, Toast…)
src/components/layout          Header, MobileNavigation, Footer, Container, Section, Grid
src/components/marketing       Hero, SolutionCard, CaseCard, ProofMetric, ProcessStep, CTASection, FAQ…
src/components/diagrams        HeroSystem, FlowDiagram, AgentFlow, SystemDiagram, DiagnosticFlow (SVG/CSS)
src/components/forms           LeadForm (2 etapas) e campos
src/components/content         ArticleCard, Breadcrumbs, RichText (MDX), CaseMetric
src/components/analytics       GTM loader, ConsentBanner/Preferences, RouteChangeTracker
src/config/site.ts             dados configuráveis (contatos, jurídico, nav, links) — sem inventar valores
src/content/solutions          conteúdo tipado das 3 soluções (copy do PRD)
src/content/cases|insights     MDX com frontmatter validado (approved/status)
src/content/home.ts|about.ts|faq.ts|legal/…  copy das páginas (fora dos componentes → i18n futura)
src/lib/analytics              dataLayer tipado, eventos, attribution (UTM)
src/lib/consent                estado de consentimento + Consent Mode v2
src/lib/leads                  schema, scoring (config única), service, store, tipos
src/lib/crm|email              adapters (CRMProvider, NotificationProvider) + factory por env
src/lib/security               rate limit, honeypot, idempotência, Turnstile, headers/CSP
src/lib/seo                    metadata helpers, JSON-LD builders, URLs canônicas
src/lib/content                loaders MDX (cases/insights), schemas, gates de publicação
src/lib/observability          logger estruturado (sem PII desnecessária), hook para error monitoring
src/instrumentation.ts         onRequestError → log JSON de erros do servidor (ponto único p/ Sentry/OTel)
src/styles                     tokens.css, globals.css, fonts.ts
scripts/                       content-check, qa-screenshots, smoke (verificação de deploy), dev/*
tests/unit|components|e2e
```

## 3. Rendering

- **Estático (SSG)**: `/`, `/solucoes/*`, `/sobre`, `/privacidade`, `/cookies`, `/contato` (o formulário é client, a página é estática), `not-found`.
- **Estático por conteúdo**: `/cases/[slug]` e `/insights/[slug]` via `generateStaticParams` (somente aprovados/publicados). Sem CMS remoto em V1 → tudo é build-time.
- **Dinâmico**: apenas `POST /api/leads` (Node runtime).
- Sem `proxy.ts` (middleware) em V1: headers de segurança e redirects ficam em `next.config.ts` (mantém páginas 100% estáticas). Se nonce-CSP for necessário no futuro, avaliar `proxy.ts` (ADR-010).

## 4. Fluxo do lead

```
LeadForm (client, 2 etapas, Zod)  --POST /api/leads-->  Route Handler
  | honeypot · timing · submissionId (idempotência) · UTMs
  v
validação server (Zod) -> sanitização -> rate limit -> scoring -> LeadService
     |- CRMProvider (webhook | none)          [falha => erro observável]
     |- NotificationProvider (resend | none)  [falha não destrói lead entregue ao CRM]
     |- LeadStore (log / jsonl em dev)        [auditoria local opcional]
resposta: { ok, requestId, leadBucket, urgencyBucket } --> dataLayer.push(generate_lead) (sem PII)
```

Regras: score nunca vai ao cliente (só bucket); PII nunca vai ao dataLayer; falha total → HTTP 502 + retry no cliente sem perder campos.

## 5. Analytics e consentimento

- GTM é a única camada de tags. O código nunca chama GA4/Meta/LinkedIn diretamente.
- Ordem no `<head>`: (1) inline: `dataLayer` + `gtag()` + **consent default** (denied, ou estado salvo) → (2) GTM (`afterInteractive`, só se `NEXT_PUBLIC_GTM_ID`).
- Banner de consentimento próprio (necessário/analytics/marketing) → `gtag('consent','update', …)` (analytics_storage, ad_storage, ad_user_data, ad_personalization) + evento `consent_update` no dataLayer.
- `page_view` disparado pelo app em toda navegação (inclusive inicial) → no GTM, GA4 config com `send_page_view: false` e tag de evento no custom event `page_view` (evita duplicidade). Contrato completo em `docs/TRACKING.md`.
- UTMs: capturadas na primeira página, mantidas em `sessionStorage` (sessão) e, com consentimento de analytics, em cookie first-party de 30 dias; anexadas ao lead no envio. Sem fingerprinting.

## 6. SEO

- Metadata API (estática por página; `generateMetadata` em rotas dinâmicas), `metadataBase` = `NEXT_PUBLIC_SITE_URL`.
- `robots.ts`/`sitemap.ts` nativos; fora de produção: `noindex` (metadata) + `Disallow: /` + header `X-Robots-Tag`.
- OG images geradas por `opengraph-image.tsx` (ImageResponse, estático no build) com fonte Urbanist local.
- JSON-LD: Organization + WebSite (Home), Service + BreadcrumbList (soluções), BreadcrumbList (cases), Article + BreadcrumbList (insights). Sem reviews/estrelas.
- Um H1 por página; hierarquia H1→H2→H3; texto crítico sempre em HTML.

## 7. Segurança

Validação/sanitização server-side; limite de payload (16 KB); honeypot; verificação de tempo mínimo; rate limit por IP (janela deslizante in-memory — interface trocável); idempotência por `submissionId`; Turnstile opcional; headers: CSP (Report-Only por padrão, `CSP_ENFORCE=true` para enforce), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS em produção; erros nunca expõem stack trace.

## 8. Conteúdo e gates de publicação

| Coleção           | Formato                             | Gate                                                        |
| ----------------- | ----------------------------------- | ----------------------------------------------------------- |
| Soluções          | TS tipado (`src/content/solutions`) | sempre publicado (3 fixas)                                  |
| Cases             | MDX + frontmatter Zod               | `approved: true`; nav/sitemap/Home só com ≥ 1 aprovado      |
| Insights          | MDX + frontmatter Zod               | `status: published`; rota/nav/sitemap só com ≥ 3 publicados |
| Métricas de prova | `src/content/proof.ts`              | `verified: true` + fonte em `docs/CONTENT-SOURCES.md`       |
| Logos             | `src/content/proof.ts`              | `authorized: true`                                          |

Migração futura para CMS: trocar os loaders em `src/lib/content` mantendo os schemas.

Revisão interna: `CONTENT_PREVIEW=true` (somente fora de produção) exibe cases não aprovados e insights em `review` com gates relaxados — ambientes de preview já são `noindex`.

## 9. Componentes (PRD §62) — estados obrigatórios

default · hover · active · focus-visible · disabled · loading · error. Nenhum componente interativo depende de hover; foco visível em tudo; `Dialog` com focus trap e ESC; menu mobile acessível.

## 10. Performance

Fontes via `next/font` (self-hosted, `display: swap`, subset latin), sem vídeo no Hero, hero em SVG/CSS (sem JS para animar), Motion carregado com `LazyMotion` (`domAnimation`), imagens com `next/image` (AVIF/WebP, dimensões fixas), scripts de terceiros só via GTM após consentimento, sem carrosséis pesados. Metas: LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 · Lighthouse mobile ≥ 90/95/95/95.
