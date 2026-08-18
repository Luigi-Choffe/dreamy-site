# Implementation Plan — Site institucional Dreamy (PRD v2.0)

Status: **V1 implementada e verificada localmente (Fases 0–7); Fase 8 (migração/produção) depende de configuração externa** · Início: 2026-08-17 · Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Motion + Zod + MDX · Gerenciador: pnpm

Este plano segue as fases 0–9 do PRD (§96–§105) e o Definition of Done por fase (§106). Cada fase tem um _gate_; a próxima não começa sem o gate anterior.

## Fase 0 — Audit & Foundation ✅

Entregáveis

- [x] Leitura integral do PRD (`docs/PRD.md`, original em `docs/source/`)
- [x] Auditoria do site atual + inventário + mapa de URLs (`docs/AUDIT-SITE-ATUAL.md`)
- [x] Screenshots desktop/mobile do site atual (`docs/audit/screenshots/`)
- [x] Extração do verde oficial a partir do logo (ADR-005)
- [x] Arquitetura (`docs/ARCHITECTURE.md`) e ADRs (`docs/DECISIONS.md`)
- [x] Estrutura do repositório (PRD §86) e regra always-on do workspace (`.agents/rules/dreamy-site.md`)
- [x] Design tokens definidos (`src/styles/tokens.css`)
- [x] Registro de itens configuráveis/pendentes (`docs/CONTENT-SOURCES.md`, `src/config/site.ts`)
      Gate: não iniciar UI antes desta fase. ✔

## Fase 1 — Design System ✅

- Tokens: cores, tipografia (clamp), espaçamento, raio, sombras, motion
- Primitivos UI: Button, LinkButton, Badge, Card, Input, Select, Textarea, Checkbox, Accordion, Dialog, Toast, Container, Section, Grid
- Estados obrigatórios: default, hover, active, focus-visible, disabled, loading, error
- Página interna `/dev/design-system` (somente fora de produção; `noindex`; removível)
  Gate: desktop + mobile validados (screenshots 390/768/1440).

## Fase 2 — Home ✅

Header (sticky, dropdown Soluções, mobile menu acessível), Hero (copy §15 + visual próprio §16), Prova (condicional a conteúdo aprovado), Problema, Três soluções, Diagnóstico (fluxo), Cases (condicional), Como trabalhamos, Fit, FAQ, CTA final, Footer.
Gate: browser review + screenshots + mobile + console limpo.

## Fase 3 — Soluções ✅

`/solucoes` (índice), `/solucoes/nova-receita-digital`, `/solucoes/sistemas-sob-medida`, `/solucoes/agentes-de-ia` com copy §27–§29, diagramas §61, CTAs com `?solucao=`, metadata §47, JSON-LD Service + BreadcrumbList.
Gate: copy correta, CTAs corretos, metadata, responsivo.

## Fase 4 — Institucional ✅

`/sobre`, `/cases` + template `[slug]` (gated por `approved`), `/insights` + `[slug]` (gated: mínimo 3 publicados), `/privacidade`, `/cookies`, `not-found`, `error`/`global-error`.
Gate: rotas funcionam, conteúdo sem placeholder, gates de publicação testados.

## Fase 5 — Conversão ✅ (adapters `none` até configurar CRM/e-mail)

Formulário em 2 etapas (`/contato`), validação Zod client+server, estados §37, `POST /api/leads` (request ID, idempotência, honeypot, rate limit, limite de payload, timeout), lead scoring configurável (§38), adapters CRM/Notificação/Agendamento (§41), UTMs/attribution (§45), pós-conversão (§39), Turnstile opcional.
Gate: formulário realmente funciona ponta a ponta (com adapters `none` em dev e `webhook`/`resend` quando configurados).

## Fase 6 — Measurement ✅ (código + docs; container GTM a configurar)

GTM (carga controlada), Consent Mode v2 + banner/preferências, dataLayer tipado (§44), `page_view` em navegação SPA, `generate_lead` sem PII, `docs/TRACKING.md` com contrato + configuração esperada no container.
Gate: eventos validados um a um (Preview do GTM), sem duplicidade, sem PII.

## Fase 7 — Hardening ✅ (ver docs/QA.md)

Testes unitários (validation, scoring, analytics helpers, seo helpers, lead transformation), componentes (LeadForm, Header, Accordion), E2E Playwright (Home→Solution, Solution→Contact, Contact→Success, erro de validação, menu mobile, 404) + axe, headers de segurança (CSP report-only → enforce), Lighthouse mobile ≥ 90/95/95/95, responsividade 320–1920, browsers.
Gate: `pnpm check` verde + relatório em `docs/QA.md`.

## Fase 8 — Migração ⏳ (documentada; requer DNS/host/Search Console)

Feito (2026-08-18): repositório publicado (`github.com/Luigi-Choffe/dreamy-site`), CI verde, produção como opt-in explícito (ADR-017), `pnpm smoke` (verificação de deploy/redirects), roteiro em `docs/DEPLOY.md`.
Pendente (externo): importar na Vercel/host, `docs/redirect-map.csv`, domínio (`dreamy.app.br` → `www`), HTTPS, produção, sitemap, Search Console, validação de analytics, DNS. Checklist §108.

## Fase 9 — Pós-lançamento ⏳

Monitorar erros (`src/instrumentation.ts` → log `server.request_error`; `docs/DEPLOY.md` § Observabilidade), leads, analytics, 404, Search Console, performance real (p75), eventos, conversão.

## Dependências externas (não bloqueiam desenvolvimento)

| Item                                                       | Necessário para   | Onde configurar                                                                                   |
| ---------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| Container GTM (ID) + GA4/Meta/LinkedIn dentro do GTM       | Fase 6            | `NEXT_PUBLIC_GTM_ID` + configuração no GTM (`docs/TRACKING.md`)                                   |
| CRM (webhook/URL/chave)                                    | Fase 5            | `CRM_PROVIDER`, `CRM_WEBHOOK_URL`, `CRM_API_KEY`                                                  |
| E-mail de leads + provedor (Resend)                        | Fase 5            | `EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY`, `LEADS_NOTIFICATION_EMAIL`, `LEADS_NOTIFICATION_FROM` |
| Ferramenta de agendamento                                  | Fase 5            | `NEXT_PUBLIC_BOOKING_URL`                                                                         |
| Cases autorizados, métricas verificadas, logos autorizados | Fases 2/4         | `src/content/cases/*.mdx` (`approved: true`) + `docs/CONTENT-SOURCES.md`                          |
| CNPJ / razão social / e-mail / endereço / LinkedIn         | Footer, políticas | `src/config/site.ts`                                                                              |
| Acesso ao Search Console (URLs indexadas, backlinks)       | Fase 8            | `docs/SEO-MIGRATION.md`                                                                           |
| Revisão jurídica das políticas                             | Lançamento        | `src/content/legal/*`                                                                             |
| SVG oficial do logo                                        | Qualidade visual  | `public/brand/`                                                                                   |

## Decisões ainda parametrizáveis (ver ADRs)

Fonte secundária, ferramenta de CMS futura, error monitoring (Sentry), rate limiting distribuído (Upstash) em produção, Turnstile, server-side tagging.

## Riscos e mitigação

| Risco                                             | Mitigação                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Falta de conteúdo de prova aprovado no lançamento | Seções condicionais; Home continua completa e coerente sem elas                       |
| CSP quebrar tags de marketing                     | Report-Only primeiro; enforce por env após validação                                  |
| Eventos duplicados GA4                            | `page_view` só via dataLayer; GA4 config tag com `send_page_view=false` (documentado) |
| Rate limit em serverless (multi-instância)        | Interface `RateLimiter`; implementação in-memory V1 + nota para Upstash               |
| Fonte não oficial                                 | ADR-004; famílias isoladas em `src/styles/fonts.ts`, troca em um único ponto          |
