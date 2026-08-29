# HANDOFF — estado atual e como retomar

Atualizado em 2026-08-18 (sessão 3). Leia isto primeiro ao retomar o projeto (junto com `.agents/rules/dreamy-site.md` e `docs/PRD.md`).

## Estado

- **V1 completa e verificada** (Fases 0–7 do PRD). Fases 8–9 (DNS/host/Search Console/pós-lançamento) dependem de configuração externa — roteiro em `docs/DEPLOY.md`.
- Repositório publicado: `https://github.com/Luigi-Choffe/dreamy-site` (privado, branch `main`; identidade de commit configurada só neste repositório = conta GitHub `Luigi-Choffe`, e-mail noreply). CI (`.github/workflows/ci.yml`) **verde** no GitHub: check ≈ 1m20s + e2e ≈ 2m40s. Dependabot mensal (`.github/dependabot.yml`).
- Último `pnpm check` local **verde** (typecheck · lint · content-check · 53 testes · build); `pnpm test:e2e` 56 passed (desktop + mobile, inclui axe); Lighthouse mobile 95–98 / 100 / 100 / 100 (`docs/qa/lighthouse/`).
- **Vercel: projeto ainda não existe.** A criação via integração (time "Rafael Lang's projects") falhou com `403 forbidden` — importar pelo painel (passo a passo em `docs/DEPLOY.md`). Sem `NEXT_PUBLIC_SITE_ENV=production` qualquer deploy sai `noindex` (ADR-017), inclusive o ambiente Production da Vercel em `*.vercel.app`.
- **Design pass 2026-08-18 (ADR-018)**: hero "sistema vivo" derivado do logo, `FlowDiagram` em rail/pílulas, cards de solução com subgrid alinhado, tokens de tipografia mais apertados. Skills instaladas pelo usuário em `.agents/skills/` e `.claude/skills/` (`frontend-design`, `copywriting`) — usar `frontend-design` para novas telas.
- Servidores locais parados. Para subir: `pnpm dev` (3000). E2E sobe sozinho `next start` em 3100. Verificação rápida de qualquer URL publicada: `pnpm smoke --base <url>`.
- **Outbound (2026-08-27)**: subsistema de campanhas de cold e-mail por indústria **implementado** (V1 local — `docs/PRD-EMAIL-OUTBOUND.md` §28, ADR-019…022). Comandos `pnpm outbound:*` (import/verify/campaign/arm/plan/send/sync/auto/reply/report/demo); copy-modelo + guia em `src/content/outbound/`. **Console completo** em `/interno/outbound` (`pnpm dev`): visão geral, campanha (funil + prévia da copy com lint), contatos, respostas, atividade, supressão; ações conservadoras por Server Actions (pausar/classificar/suprimir/desarmar — armar/disparar só na CLI); **modo demo**: `pnpm outbound:demo` + `/interno/outbound?demo=1` (dados simulados). Screenshots: `docs/qa/outbound-console/`. **Lote construção importado** (2026-08-27): `docs/CONTATOS/Luigi_CONSTRUCAO.xlsx` (abas Empresas/Pessoas — gitignored), 99 empresas segmentadas + 42 contatos ativos no store real, 99 aberturas personalizadas, campanha `construcao-nova-receita` em draft (mira 16 incorporadoras). Chave Resend em `.env.local`; domínio `bedreamy.com.br` verificado (DKIM/SPF). Aguardando do usuário: verificação dos 42 e-mails, `OUTBOUND_FROM`/`OUTBOUND_REPLY_TO`, DMARC, aprovação da copy, CNPJ/razão social e `outbound:arm`.

## Mapa rápido

| Preciso de…                                       | Onde                                                  |
| ------------------------------------------------- | ----------------------------------------------------- |
| Fonte de verdade                                  | `docs/PRD.md`                                         |
| Regras do agente                                  | `.agents/rules/dreamy-site.md`, `CLAUDE.md`           |
| Plano/fases                                       | `docs/IMPLEMENTATION-PLAN.md`                         |
| Arquitetura                                       | `docs/ARCHITECTURE.md`                                |
| Decisões (ADR-001…018)                            | `docs/DECISIONS.md`                                   |
| Auditoria do site antigo                          | `docs/AUDIT-SITE-ATUAL.md` + `docs/audit/`            |
| Prova/claims permitidos                           | `docs/CONTENT-SOURCES.md`                             |
| Copy autoral a revisar                            | `docs/COPY-REVIEW.md`                                 |
| Tracking/GTM                                      | `docs/TRACKING.md`                                    |
| QA e resultados                                   | `docs/QA.md`, `docs/qa/final/`, `docs/qa/lighthouse/` |
| Migração SEO/domínio                              | `docs/SEO-MIGRATION.md`, `docs/redirect-map.csv`      |
| Deploy (Vercel/host), preview × produção, go-live | `docs/DEPLOY.md`                                      |
| Apresentação institucional (PDF + fonte HTML)     | `docs/apresentacao/`                                  |
| Campanhas de e-mail outbound (PRD)                | `docs/PRD-EMAIL-OUTBOUND.md`                          |
| MORK (agente de outbound: identidade + playbook)  | `.agents/mork/MORK.md`, `.agents/mork/PLAYBOOK.md`    |
| Checklist de lançamento                           | `docs/LAUNCH-CHECKLIST.md`                            |
| Variáveis de ambiente                             | `.env.example`, README                                |

## Decisões que ainda precisam de confirmação da Dreamy

1. **Tema**: base clara com seções escuras (ADR-014). Para site 100% escuro: `data-theme="dark"` no `<html>` (`src/app/layout.tsx`) + revisar Hero.
2. **WhatsApp** `+55 11 94879-3233` como padrão (`src/config/site.ts`); CNPJ/razão social/e-mail/endereço/LinkedIn estão `null` (omitidos na UI).
3. **Tipografia** Urbanist + Instrument Sans (ADR-004) — trocar em `src/styles/fonts.ts` se houver fonte oficial.
4. **Copy autoral** e **rascunhos de Insights** (`status: review`, 3 arquivos em `src/content/insights/`) — revisar; publicar exige ≥ 3 `published`.
5. **Políticas** de privacidade/cookies (`src/content/legal/`) — validação jurídica.

## Pendências externas (não bloqueiam código)

- Importar o repositório na Vercel (ou outro host) — `docs/DEPLOY.md`.
- `NEXT_PUBLIC_GTM_ID` + container GTM conforme `docs/TRACKING.md` (GA4 `send_page_view=false`, tag de `page_view` no evento custom, Meta/LinkedIn com consentimento).
- CRM (`CRM_PROVIDER=webhook`, `CRM_WEBHOOK_URL`, `CRM_API_KEY`), e-mail (`EMAIL_PROVIDER=resend` + chave + `LEADS_NOTIFICATION_EMAIL/FROM`), `NEXT_PUBLIC_BOOKING_URL`, Turnstile (opcional), Redis REST (`KV_REST_API_URL/TOKEN`, opcional — rate limit/idempotência globais em serverless).
- Cases aprovados (`approved: true` + `approvalRef` + `docs/CONTENT-SOURCES.md`), logos/métricas autorizados (`src/content/proof.ts`).
- Produção: `NEXT_PUBLIC_SITE_ENV=production` (opt-in explícito — ADR-017), `NEXT_PUBLIC_SITE_URL=https://www.dreamy.app.br`, apex → www no host, Search Console, remover GA4 direto do Framer.

## Próximos passos sugeridos (em ordem)

1. ~~Commit inicial, publicar repositório e conectar CI~~ ✅ (2026-08-18).
2. Importar o repositório na Vercel (painel — `docs/DEPLOY.md`); rodar `pnpm smoke --base <url-do-preview>` e revisar no browser (Safari/iOS manual — PRD §91).
3. Preencher variáveis do preview: GTM (validar eventos no Preview do GTM), CRM webhook e Resend com lead de teste; `CONTENT_PREVIEW=true` para revisar insights/cases não publicados.
4. Revisar decisões acima; publicar Insights quando ≥ 3 aprovados; adicionar cases quando aprovados.
5. Avaliar `CSP_ENFORCE=true` após validar tags no browser.
6. **Outbound**: fornecer chave Resend dedicada + domínio de envio (DNS: DKIM/SPF/MX/DMARC) + CNPJ/razão social; enviar a lista do Clay; rodar o fluxo do PRD-EMAIL-OUTBOUND §28.2 (import → verify → copy por indústria → approve/enroll → arm → install-schedule.ps1).
6. Fase 8: `NEXT_PUBLIC_SITE_ENV=production` + `NEXT_PUBLIC_SITE_URL` no ambiente de produção, domínios/DNS conforme `docs/SEO-MIGRATION.md`, depois `pnpm smoke --base https://www.dreamy.app.br --expect production --redirects`; Fase 9: monitoramento (`docs/LAUNCH-CHECKLIST.md`).

## Armadilhas conhecidas (ambiente/dev)

- Windows/Git Bash: use `MSYS_NO_PATHCONV=1` antes de comandos com rotas iniciando em `/` (ex.: `pnpm tsx scripts/qa-screenshots.ts --routes /contato`).
- Lighthouse local: `CHROME_PATH` apontando para o Chromium do Playwright (`%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`) e servidor `next start` em 3100 (matar processo anterior na porta antes de rebuild).
- Zod 4: schema do lead usa `zod/mini` + `jitless` (CSP sem `unsafe-eval`); schemas de conteúdo usam `zod` clássico e aceitam datas YAML sem aspas.
- Reveals são CSS + IntersectionObserver (`data-reveal`); sem JS tudo fica visível.
- Git no Windows: `core.autocrlf=true` na máquina; o repositório força LF via `.gitattributes` (`* text=auto eol=lf`) — não "consertar" CRLF/LF à mão. Identidade de commit só neste repositório (`git config user.name/email`, sem `--global`).
- Vercel via integração nesta máquina: `list_*` funciona; `create_git_project` retorna 403 (sem permissão de criar projeto) — usar o painel.
- Dependabot (npm) aplica cooldown de 3 dias (`minimumReleaseAge`): logo após um `pnpm install` com pacotes recém-publicados o job "Dependabot Updates" falha com `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` — transitório, resolve sozinho quando os pacotes envelhecem. Os PRs de bump de actions passam pelo CI completo antes de merge.
- Utilitários: `scripts/dev/ui-shots.ts <pasta> [base]` (banner de cookies, menu mobile, preferências, dropdown), `scripts/dev/form-shots.ts <pasta> [base]` (formulário: erros, passo 2, sucesso), `scripts/dev/deck-shots.ts <html> <pasta> [escala]` (screenshots por slide da apresentação), `scripts/dev/build-deck-pptx.py <pasta-shots>` (PPTX com notas do apresentador; requer `pip install python-pptx`), `scripts/dev/build-deck-native.py [pasta-shots]` (PPTX nativo editável com animações via COM do PowerPoint; requer PowerPoint + `pip install pywin32`), `scripts/dev/pitch-shots.ts <pasta>` (screenshots da apresentação HTML viva), `scripts/dev/overflow-check.ts`, `reveal-check.ts`, `csp-check.ts`, `axe-check.ts` (dev), `pnpm qa:screenshots --viewports … --no-shots` (só checagens), `pnpm smoke --base <url>` (deploy).
