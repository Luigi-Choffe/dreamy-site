# HANDOFF — estado atual e como retomar

Atualizado em 2026-08-18. Leia isto primeiro ao retomar o projeto (junto com `.agents/rules/dreamy-site.md` e `docs/PRD.md`).

## Estado

- **V1 completa e verificada localmente** (Fases 0–7 do PRD). Fases 8–9 (DNS/host/Search Console/pós-lançamento) dependem de configuração externa.
- Último `pnpm check` (typecheck · lint · content-check · 53 testes unit/componentes · build) **verde**; `pnpm test:e2e` **56 passed** (desktop + mobile, inclui axe); Lighthouse mobile 95–98 / 100 / 100 / 100 (`docs/qa/lighthouse/`).
- Repositório: `git init` feito, **nenhum commit ainda** (aguardando ordem). `PRD v2.docx` na raiz está no `.gitignore` (cópia oficial em `docs/source/`).
- Servidores locais parados. Para subir: `pnpm dev` (3000). E2E sobe sozinho `next start` em 3100.

## Mapa rápido

| Preciso de…              | Onde                                                  |
| ------------------------ | ----------------------------------------------------- |
| Fonte de verdade         | `docs/PRD.md`                                         |
| Regras do agente         | `.agents/rules/dreamy-site.md`, `CLAUDE.md`           |
| Plano/fases              | `docs/IMPLEMENTATION-PLAN.md`                         |
| Arquitetura              | `docs/ARCHITECTURE.md`                                |
| Decisões (ADR-001…016)   | `docs/DECISIONS.md`                                   |
| Auditoria do site antigo | `docs/AUDIT-SITE-ATUAL.md` + `docs/audit/`            |
| Prova/claims permitidos  | `docs/CONTENT-SOURCES.md`                             |
| Copy autoral a revisar   | `docs/COPY-REVIEW.md`                                 |
| Tracking/GTM             | `docs/TRACKING.md`                                    |
| QA e resultados          | `docs/QA.md`, `docs/qa/final/`, `docs/qa/lighthouse/` |
| Migração SEO/domínio     | `docs/SEO-MIGRATION.md`, `docs/redirect-map.csv`      |
| Checklist de lançamento  | `docs/LAUNCH-CHECKLIST.md`                            |
| Variáveis de ambiente    | `.env.example`, README                                |

## Decisões que ainda precisam de confirmação da Dreamy

1. **Tema**: base clara com seções escuras (ADR-014). Para site 100% escuro: `data-theme="dark"` no `<html>` (`src/app/layout.tsx`) + revisar Hero.
2. **WhatsApp** `+55 11 94879-3233` como padrão (`src/config/site.ts`); CNPJ/razão social/e-mail/endereço/LinkedIn estão `null` (omitidos na UI).
3. **Tipografia** Urbanist + Instrument Sans (ADR-004) — trocar em `src/styles/fonts.ts` se houver fonte oficial.
4. **Copy autoral** e **rascunhos de Insights** (`status: review`, 3 arquivos em `src/content/insights/`) — revisar; publicar exige ≥ 3 `published`.
5. **Políticas** de privacidade/cookies (`src/content/legal/`) — validação jurídica.

## Pendências externas (não bloqueiam código)

- `NEXT_PUBLIC_GTM_ID` + container GTM conforme `docs/TRACKING.md` (GA4 `send_page_view=false`, tag de `page_view` no evento custom, Meta/LinkedIn com consentimento).
- CRM (`CRM_PROVIDER=webhook`, `CRM_WEBHOOK_URL`, `CRM_API_KEY`), e-mail (`EMAIL_PROVIDER=resend` + chave + `LEADS_NOTIFICATION_EMAIL/FROM`), `NEXT_PUBLIC_BOOKING_URL`, Turnstile (opcional).
- Cases aprovados (`approved: true` + `approvalRef` + `docs/CONTENT-SOURCES.md`), logos/métricas autorizados (`src/content/proof.ts`).
- Produção: `NEXT_PUBLIC_SITE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.dreamy.app.br`, apex → www no host, Search Console, remover GA4 direto do Framer.

## Próximos passos sugeridos (em ordem)

1. Commit inicial (`git add -A && git commit`), publicar repositório e conectar CI (`.github/workflows/ci.yml`).
2. Deploy de preview (Vercel ou host Node) — sai automaticamente `noindex`; revisar no browser (Safari/iOS manual — PRD §91).
3. Preencher `.env` de preview: GTM (validar eventos no Preview do GTM), CRM webhook e Resend com lead de teste.
4. Revisar decisões acima; publicar Insights quando ≥ 3 aprovados; adicionar cases quando aprovados.
5. Avaliar `CSP_ENFORCE=true` após validar tags no browser.
6. Fase 8: DNS/domínio conforme `docs/SEO-MIGRATION.md`; Fase 9: monitoramento (`docs/LAUNCH-CHECKLIST.md`).

## Armadilhas conhecidas (ambiente/dev)

- Windows/Git Bash: use `MSYS_NO_PATHCONV=1` antes de comandos com rotas iniciando em `/` (ex.: `pnpm tsx scripts/qa-screenshots.ts --routes /contato`).
- Lighthouse local: `CHROME_PATH` apontando para o Chromium do Playwright (`%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`) e servidor `next start` em 3100 (matar processo anterior na porta antes de rebuild).
- Zod 4: schema do lead usa `zod/mini` + `jitless` (CSP sem `unsafe-eval`); schemas de conteúdo usam `zod` clássico e aceitam datas YAML sem aspas.
- Reveals são CSS + IntersectionObserver (`data-reveal`); sem JS tudo fica visível.
- Utilitários: `scripts/dev/overflow-check.ts`, `reveal-check.ts`, `csp-check.ts`, `axe-check.ts` (dev), `pnpm qa:screenshots --viewports … --no-shots` (só checagens).
