# DEPLOY — preview e produção

Complementa `docs/SEO-MIGRATION.md` (domínio) e `docs/LAUNCH-CHECKLIST.md` (go-live). Host recomendado: Vercel; qualquer host Node/Next funciona igual (build `pnpm build`, start `pnpm start`).

## Estado

- Repositório: `https://github.com/Luigi-Choffe/dreamy-site` (privado, branch `main`). CI em `.github/workflows/ci.yml` roda em cada push/PR (check + e2e).
- Projeto Vercel: **ainda não criado**. A tentativa via integração (conta "Rafael Lang's projects") retornou `403 forbidden` para criar projeto — precisa ser feito no painel (abaixo) ou por alguém com permissão de criar projetos no time.

## Regimes de ambiente (ADR-017)

| Regime            | Como se define                                        | Comportamento                                                                                                                           |
| ----------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Preview / staging | qualquer deploy sem `NEXT_PUBLIC_SITE_ENV=production` | `noindex` (meta + `X-Robots-Tag`), `robots.txt` `Disallow: /`, sitemap vazio, canônicas apontando para `https://www.dreamy.app.br`      |
| Produção          | `NEXT_PUBLIC_SITE_ENV=production` (opt-in explícito)  | indexável, sitemap completo (respeita gates de conteúdo), HSTS, redirect apex→www em `next.config.ts` (redundância ao redirect do host) |

O ambiente "Production" da Vercel (branch `main`, `VERCEL_ENV=production`) **continua noindex** enquanto a variável não existir — é o que permite revisar o site em `*.vercel.app` sem risco de indexação antes da migração.

## Vercel — importar o repositório (uma vez)

1. Vercel → **Add New… → Project → Import Git Repository** → conectar o GitHub `Luigi-Choffe` (instalar o Vercel GitHub App com acesso a `dreamy-site`) → Import.
2. Framework: Next.js (detectado). Root: `/`. Install/Build: padrão (`pnpm install` / `next build`, pnpm 11 via `packageManager`). Node: 22+ (padrão do host).
3. Environment Variables: **nenhuma obrigatória** para preview. Opcionais (todas em `.env.example`): `NEXT_PUBLIC_GTM_ID`, `CRM_*`, `EMAIL_*`, `NEXT_PUBLIC_BOOKING_URL`, `TURNSTILE_*`, `CONTENT_PREVIEW=true` (para revisar insights/cases não publicados no preview).
4. Deploy. O primeiro deploy sai em `https://dreamy-site-<hash>.vercel.app` / `https://dreamy-site.vercel.app`, já `noindex`.
5. Verificar: `pnpm smoke --base https://dreamy-site.vercel.app` (esperado: regime preview, todas as verificações OK) e, se quiser o pacote completo, `PLAYWRIGHT_BASE_URL=https://dreamy-site.vercel.app pnpm test:e2e`.
6. Opcional: **Settings → Deployment Protection → Vercel Authentication** para restringir o preview a membros do time (padrão: público, sem indexação).

Cada push em `main` gera um novo deploy; PRs geram Preview Deployments próprios.

## Go-live (resumo — detalhes em `docs/SEO-MIGRATION.md` e `docs/LAUNCH-CHECKLIST.md`)

1. Concluir a checklist de conteúdo/decisões (`docs/HANDOFF.md`).
2. Vercel → Settings → Environment Variables (**Production**): `NEXT_PUBLIC_SITE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.dreamy.app.br` + integrações reais (GTM, CRM, e-mail). Redeploy.
3. Vercel → Settings → Domains: adicionar `www.dreamy.app.br` (primário) e `dreamy.app.br` com **Redirect to www** (308). Ajustar DNS conforme instruções do painel (CNAME `www` → `cname.vercel-dns.com`; apex → A/ALIAS indicado).
4. Assim que o DNS propagar: `pnpm smoke --base https://www.dreamy.app.br --expect production --redirects` (valida indexação liberada, HSTS, sitemap, redirects apex/http e o `docs/redirect-map.csv`).
5. Search Console: propriedade de domínio, enviar `https://www.dreamy.app.br/sitemap.xml`. Desligar o Framer / GA4 direto do site antigo.
6. Depois de validar as tags no browser (GTM Preview): `CSP_ENFORCE=true` e redeploy; acompanhar console/relatórios.

## Outros hosts

Docker/Node: `pnpm install --frozen-lockfile && pnpm build && pnpm start` (porta `PORT`, padrão 3000). Precisa de Node ≥ 20.9. Configure as mesmas variáveis; o redirect apex→www também deve existir no host/DNS (a regra do `next.config.ts` só cobre requisições que já chegam ao Node com host `dreamy.app.br`).

## Observabilidade

- Logs estruturados (JSON, uma linha por evento) em stdout: leads (`lead.*`), integrações (`crm.*`, `email.*`) e erros de servidor (`server.request_error`, via `src/instrumentation.ts`). Sem PII, exceto o log de última instância `lead.delivery_failed_all` (PRD §79).
- Na Vercel: Project → Logs (filtrar por `event`). Para Sentry/OTel: ponto único em `src/instrumentation.ts` (`register`) e `src/lib/observability/*`.
- Health: qualquer rota estática responde 200; `GET /api/leads` responde 405 (serve como probe da função). Smoke completo: `pnpm smoke --base <url>`.
