# HANDOFF — estado atual e como retomar

Atualizado em 2026-08-30 (pivô para plataforma de vendas — ver bullet **PIVÔ** abaixo). Leia isto primeiro ao retomar o projeto (junto com `.agents/rules/dreamy-site.md`, `docs/PRD.md` e, para o outbound, `docs/PRD-EMAIL-OUTBOUND.md` §28–29).

## Estado

- **V1 completa e verificada** (Fases 0–7 do PRD). Fases 8–9 (DNS/host/Search Console/pós-lançamento) dependem de configuração externa — roteiro em `docs/DEPLOY.md`.
- Repositório publicado: `https://github.com/Luigi-Choffe/dreamy-site` (privado, branch `main`; identidade de commit configurada só neste repositório = conta GitHub `Luigi-Choffe`, e-mail noreply). CI (`.github/workflows/ci.yml`) **verde** no GitHub: check ≈ 1m20s + e2e ≈ 2m40s. Dependabot mensal (`.github/dependabot.yml`).
- Último `pnpm check` local **verde** (typecheck · lint · content-check · 53 testes · build); `pnpm test:e2e` 56 passed (desktop + mobile, inclui axe); Lighthouse mobile 95–98 / 100 / 100 / 100 (`docs/qa/lighthouse/`).
- **Vercel: projeto `dreamy-site` criado pelo Luigi em 2026-08-30** (time `luigichoffedremay`, `https://dreamy-site-murex.vercel.app`, deploy automático a cada push em `main`; Neon conectado). A integração desta máquina é de outra conta (`403`) — operações na Vercel são cliques do Luigi. **Desde o pivô, o projeto Vercel deste repo é a plataforma** (roteiro em `docs/DEPLOY-PLATAFORMA.md`; `docs/DEPLOY.md` fica como referência do site). Sem `NEXT_PUBLIC_SITE_ENV=production` qualquer deploy sai `noindex` (ADR-017) — e na plataforma essa variável **nunca** é definida.
- **Design pass 2026-08-18 (ADR-018)**: hero "sistema vivo" derivado do logo, `FlowDiagram` em rail/pílulas, cards de solução com subgrid alinhado, tokens de tipografia mais apertados. Skills instaladas pelo usuário em `.agents/skills/` e `.claude/skills/` (`frontend-design`, `copywriting`) — usar `frontend-design` para novas telas.
- Servidores locais parados. Para subir: `pnpm dev` (3000). E2E sobe sozinho `next start` em 3100. Verificação rápida de qualquer URL publicada: `pnpm smoke --base <url>`.
- **Outbound (2026-08-27)**: subsistema de campanhas de cold e-mail por indústria **implementado** (V1 local — `docs/PRD-EMAIL-OUTBOUND.md` §28, ADR-019…022). Comandos `pnpm outbound:*` (import/verify/campaign/arm/plan/send/sync/auto/reply/report/demo); copy-modelo + guia em `src/content/outbound/`. **Console completo** em `/interno/outbound` (`pnpm dev`): visão geral, campanha (funil + prévia da copy com lint), contatos, respostas, atividade, supressão; ações conservadoras por Server Actions (pausar/classificar/suprimir/desarmar — armar/disparar só na CLI); **modo demo**: `pnpm outbound:demo` + `/interno/outbound?demo=1` (dados simulados). Screenshots: `docs/qa/outbound-console/`. **Lote construção importado** (2026-08-27): `docs/CONTATOS/Luigi_CONSTRUCAO.xlsx` (abas Empresas/Pessoas — gitignored), 99 empresas segmentadas + 42 contatos ativos no store real, 99 aberturas personalizadas, campanha `construcao-nova-receita` em draft (mira 16 incorporadoras). Chave Resend em `.env.local`; domínio `bedreamy.com.br` verificado (DKIM/SPF). Aguardando do usuário: verificação dos 42 e-mails, `OUTBOUND_FROM`/`OUTBOUND_REPLY_TO`, DMARC, aprovação da copy, CNPJ/razão social e `outbound:arm`. **Atualização 2026-08-29**: copy aprovada (Luigi Choffe), automação **ARMADA**, 1º disparo seg 2026-08-31 09:05 pela tarefa local `DreamyOutboundAuto`; MORK criado (`.agents/mork/`, skill `/mork`).
- **PIVÔ 2026-08-29 — plataforma de vendas**: este repo deixa de ser o site institucional (duplicado e hospedado pelo sócio em outro lugar) e vira a **plataforma de vendas da Dreamy**: console `/interno/outbound` na **Vercel** (`mork.bedreamy.com.br`, `OUTBOUND_PLATFORM_ONLY=true` redireciona `/` para o console) com **login por link mágico** para o time (allowlist `OUTBOUND_TEAM_EMAILS`, cookie HMAC 30 dias — ADR-024) e **Postgres Neon** compartilhado entre o console e os CLIs do PC do Luigi (`OUTBOUND_DATABASE_URL`; sem a env, store local — ADR-023; `pnpm outbound:db migrate | push | pull | status`). Adapter Postgres e auth por link mágico já publicados (`main`, CI verde). PRD-EMAIL-OUTBOUND §29 = arquitetura + roadmap (P2 Vercel Cron, P3 webhooks/one-click, P4 respostas automáticas, P5 remoção do site). **Estado 2026-08-30**: itens 1–2 do `docs/DEPLOY-PLATAFORMA.md` feitos (projeto Vercel + Neon conectado). **Próximo passo**: item 3 (envs + Redeploy + login de teste) → item 4 (migração `pnpm outbound:db migrate`/`push` fora da janela de envio) → item 5 (domínio `mork.bedreamy.com.br`).

## Mapa rápido

| Preciso de…                                          | Onde                                                  |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Fonte de verdade                                     | `docs/PRD.md`                                         |
| Regras do agente                                     | `.agents/rules/dreamy-site.md`, `CLAUDE.md`           |
| Plano/fases                                          | `docs/IMPLEMENTATION-PLAN.md`                         |
| Arquitetura                                          | `docs/ARCHITECTURE.md`                                |
| Decisões (ADR-001…024)                               | `docs/DECISIONS.md`                                   |
| Auditoria do site antigo                             | `docs/AUDIT-SITE-ATUAL.md` + `docs/audit/`            |
| Prova/claims permitidos                              | `docs/CONTENT-SOURCES.md`                             |
| Copy autoral a revisar                               | `docs/COPY-REVIEW.md`                                 |
| Tracking/GTM                                         | `docs/TRACKING.md`                                    |
| QA e resultados                                      | `docs/QA.md`, `docs/qa/final/`, `docs/qa/lighthouse/` |
| Migração SEO/domínio                                 | `docs/SEO-MIGRATION.md`, `docs/redirect-map.csv`      |
| Deploy da plataforma (Vercel + Neon + login do time) | `docs/DEPLOY-PLATAFORMA.md`                           |
| Deploy do site (referência; site hoje é do sócio)    | `docs/DEPLOY.md`                                      |
| Apresentação institucional (PDF + fonte HTML)        | `docs/apresentacao/`                                  |
| Campanhas de e-mail outbound (PRD)                   | `docs/PRD-EMAIL-OUTBOUND.md`                          |
| MORK (agente de outbound: identidade + playbook)     | `.agents/mork/MORK.md`, `.agents/mork/PLAYBOOK.md`    |
| Checklist de lançamento                              | `docs/LAUNCH-CHECKLIST.md`                            |
| Variáveis de ambiente                                | `.env.example`, README                                |

## Decisões que ainda precisam de confirmação da Dreamy

1. **Tema**: base clara com seções escuras (ADR-014). Para site 100% escuro: `data-theme="dark"` no `<html>` (`src/app/layout.tsx`) + revisar Hero.
2. **WhatsApp** `+55 11 94879-3233` como padrão (`src/config/site.ts`); CNPJ/razão social/e-mail/endereço/LinkedIn estão `null` (omitidos na UI).
3. **Tipografia** Urbanist + Instrument Sans (ADR-004) — trocar em `src/styles/fonts.ts` se houver fonte oficial.
4. **Copy autoral** e **rascunhos de Insights** (`status: review`, 3 arquivos em `src/content/insights/`) — revisar; publicar exige ≥ 3 `published`.
5. **Políticas** de privacidade/cookies (`src/content/legal/`) — validação jurídica.

## Pendências externas (não bloqueiam código)

- Importar o repositório na Vercel como **plataforma** — `docs/DEPLOY-PLATAFORMA.md` (Neon, envs `OUTBOUND_*`, domínio `mork.bedreamy.com.br`).
- `NEXT_PUBLIC_GTM_ID` + container GTM conforme `docs/TRACKING.md` (GA4 `send_page_view=false`, tag de `page_view` no evento custom, Meta/LinkedIn com consentimento).
- CRM (`CRM_PROVIDER=webhook`, `CRM_WEBHOOK_URL`, `CRM_API_KEY`), e-mail (`EMAIL_PROVIDER=resend` + chave + `LEADS_NOTIFICATION_EMAIL/FROM`), `NEXT_PUBLIC_BOOKING_URL`, Turnstile (opcional), Redis REST (`KV_REST_API_URL/TOKEN`, opcional — rate limit/idempotência globais em serverless).
- Cases aprovados (`approved: true` + `approvalRef` + `docs/CONTENT-SOURCES.md`), logos/métricas autorizados (`src/content/proof.ts`).
- Produção: `NEXT_PUBLIC_SITE_ENV=production` (opt-in explícito — ADR-017), `NEXT_PUBLIC_SITE_URL=https://www.dreamy.app.br`, apex → www no host, Search Console, remover GA4 direto do Framer.

## Próximos passos sugeridos (em ordem)

1. ~~Commit inicial, publicar repositório e conectar CI~~ ✅ (2026-08-18).
2. **Plataforma**: importar o repositório na Vercel pelo painel e seguir `docs/DEPLOY-PLATAFORMA.md` (Storage → Neon, envs, `pnpm outbound:db migrate` + `push`, domínio `mork.bedreamy.com.br`, primeiro login, checklist). Os itens 3–5 abaixo valem só para o site, se ele voltar a ser servido daqui.
3. Preencher variáveis do preview: GTM (validar eventos no Preview do GTM), CRM webhook e Resend com lead de teste; `CONTENT_PREVIEW=true` para revisar insights/cases não publicados.
4. Revisar decisões acima; publicar Insights quando ≥ 3 aprovados; adicionar cases quando aprovados.
5. Avaliar `CSP_ENFORCE=true` após validar tags no browser.
6. **Outbound**: acompanhar o 1º disparo (seg 2026-08-31) e as respostas com o MORK (`.agents/mork/PLAYBOOK.md`); depois do deploy da plataforma, fases P2–P5 do PRD-EMAIL-OUTBOUND §29.3 (Vercel Cron, webhooks + one-click, respostas automáticas, remoção do site deste repo).
7. ~~Fase 8/9 (go-live do site em `www.dreamy.app.br`)~~ — não se aplica mais a este repo (site com o sócio); roteiro mantido em `docs/DEPLOY.md`/`docs/SEO-MIGRATION.md` como referência.

## Armadilhas conhecidas (ambiente/dev)

- Windows/Git Bash: use `MSYS_NO_PATHCONV=1` antes de comandos com rotas iniciando em `/` (ex.: `pnpm tsx scripts/qa-screenshots.ts --routes /contato`).
- Lighthouse local: `CHROME_PATH` apontando para o Chromium do Playwright (`%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`) e servidor `next start` em 3100 (matar processo anterior na porta antes de rebuild).
- Zod 4: schema do lead usa `zod/mini` + `jitless` (CSP sem `unsafe-eval`); schemas de conteúdo usam `zod` clássico e aceitam datas YAML sem aspas.
- Reveals são CSS + IntersectionObserver (`data-reveal`); sem JS tudo fica visível.
- Git no Windows: `core.autocrlf=true` na máquina; o repositório força LF via `.gitattributes` (`* text=auto eol=lf`) — não "consertar" CRLF/LF à mão. Identidade de commit só neste repositório (`git config user.name/email`, sem `--global`).
- Vercel via integração nesta máquina: `list_*` funciona; `create_git_project` retorna 403 (sem permissão de criar projeto) — usar o painel.
- Dependabot (npm) aplica cooldown de 3 dias (`minimumReleaseAge`): logo após um `pnpm install` com pacotes recém-publicados o job "Dependabot Updates" falha com `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` — transitório, resolve sozinho quando os pacotes envelhecem. Os PRs de bump de actions passam pelo CI completo antes de merge.
- Utilitários: `scripts/dev/ui-shots.ts <pasta> [base]` (banner de cookies, menu mobile, preferências, dropdown), `scripts/dev/form-shots.ts <pasta> [base]` (formulário: erros, passo 2, sucesso), `scripts/dev/deck-shots.ts <html> <pasta> [escala]` (screenshots por slide da apresentação), `scripts/dev/build-deck-pptx.py <pasta-shots>` (PPTX com notas do apresentador; requer `pip install python-pptx`), `scripts/dev/build-deck-native.py [pasta-shots]` (PPTX nativo editável com animações via COM do PowerPoint; requer PowerPoint + `pip install pywin32`), `scripts/dev/pitch-shots.ts <pasta>` (screenshots da apresentação HTML viva), `scripts/dev/overflow-check.ts`, `reveal-check.ts`, `csp-check.ts`, `axe-check.ts` (dev), `pnpm qa:screenshots --viewports … --no-shots` (só checagens), `pnpm smoke --base <url>` (deploy).
