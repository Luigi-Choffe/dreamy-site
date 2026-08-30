# DEPLOY-PLATAFORMA — console de vendas na Vercel (mork.bedreamy.com.br)

Roteiro para o Luigi colocar a plataforma de vendas no ar: console `/interno/outbound` hospedado na Vercel, banco Postgres (Neon) compartilhado com os CLIs do PC, login por e-mail para o time. Contexto e arquitetura: `docs/PRD-EMAIL-OUTBOUND.md` §29; decisões: ADR-023 (banco) e ADR-024 (auth) em `docs/DECISIONS.md`; nomes de env: `.env.example`. `docs/DEPLOY.md` (site, go-live em dreamy.app.br) fica como referência do site, que agora é hospedado pelo sócio — **neste projeto Vercel nunca definir `NEXT_PUBLIC_SITE_ENV=production`**.

## Estado (2026-08-30)

- Projeto Vercel: **ainda não existe** — a integração desta máquina não tem permissão de criar projeto (`403`); é import pelo painel (passo 1).
- Código: adapter Postgres + `pnpm outbound:db` (ADR-023) e login por link mágico com proxy (ADR-024) já no repo e publicados no `main` em 2026-08-30. Sem `OUTBOUND_DATABASE_URL`, tudo continua no store local `.outbound/` (dev/demo).
- Operação: campanha `construcao-nova-receita` aprovada e ARMADA; tarefa `DreamyOutboundAuto` (dias úteis 09:05) segue no PC do Luigi e passa a gravar no banco depois do passo 4.

## Como as peças se ligam

```
time (e-mails da allowlist) ──link mágico (Resend)──► https://mork.bedreamy.com.br
                                                        /interno/login → cookie 30 d → /interno/outbound
                                                                 │ OUTBOUND_DATABASE_URL (pooled)
PC do Luigi: pnpm outbound:* + tarefa 09:05 ──── mesmo banco ──► Postgres Neon (Storage do projeto Vercel)
                                                                 │
                                                        Resend (campanhas + e-mail de login)
```

Pré-requisitos: acesso ao GitHub `Luigi-Choffe/dreamy-site`; conta Vercel (Hobby serve — ver §9); chave Resend do outbound (a do `.env.local`); acesso à zona DNS de `bedreamy.com.br` na Hostinger.

## 1. Vercel — importar o repositório (uma vez)

1. vercel.com → entrar → **Add New… → Project**.
2. **Import Git Repository**: procurar `dreamy-site`. Se não aparecer: **Adjust GitHub App Permissions** → instalar/autorizar o Vercel GitHub App na conta `Luigi-Choffe` com acesso ao repositório `dreamy-site` → voltar → **Import**.
3. Configure Project: Framework Preset **Next.js** (detectado) · Root Directory `./` · Build and Output Settings padrão (`pnpm install` / `next build`; pnpm 11 via `packageManager`) · Node 22 (padrão). Nome do projeto: `dreamy-site` (ou `mork`).
4. Environment Variables: pode deixar vazio agora (passo 3) — o primeiro deploy só serve para criar o projeto.
5. **Deploy** → aguardar o build (2–3 min) → URL `https://<projeto>.vercel.app`. Nesse deploy a raiz ainda mostra o site (noindex, ADR-017) e o console fica sem banco: normal até o passo 3.

## 2. Storage — Postgres Neon (uma vez)

1. Projeto → aba **Storage** → **Create Database** → em _Marketplace Database Providers_ escolher **Neon** (Serverless Postgres) → **Continue**.
2. Plano **Free** · região **Washington, D.C. (us-east-1)** — a mesma das funções da Vercel (`iad1`); as consultas do PC toleram a latência · nome ex.: `dreamy-outbound` → **Create**.
3. **Connect Project**: projeto `dreamy-site` → Environments **Production** + **Preview** (Development opcional) → **Connect**. A Vercel injeta no projeto `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `PGHOST`, `POSTGRES_URL` etc.
4. Criar a variável que o código lê: Storage → banco criado → aba **.env.local** (ou Quickstart) → **Show secret** → copiar o valor de `DATABASE_URL` — o host tem `-pooler` (ex.: `postgresql://neondb_owner:…@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`). Depois: Settings → **Environment Variables** → Key `OUTBOUND_DATABASE_URL` · Value colado · Environments Production + Preview · **Save**.
   - Só a string **pooled** (`-pooler`) — é a que o driver serverless usa (ADR-023). Ignorar `_UNPOOLED`/`NON_POOLING`.
   - Alternativa: **Open in Neon** → Connection Details → marcar _Pooled connection_ → copiar.
5. Guardar a mesma string para o `.env.local` do PC (passo 4).

## 3. Variáveis do projeto (Settings → Environment Variables)

Marcar **Production** (e Preview, se for testar branches). **Toda alteração de env só vale em deploy novo**: Deployments → último deploy → **⋯ → Redeploy**.

| Key                                                                   | Valor                                                                              | Nota                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `OUTBOUND_PLATFORM_ONLY`                                              | `true`                                                                             | raiz `/` → 307 para `/interno/outbound`; o site institucional vive no deploy do sócio  |
| `OUTBOUND_DATABASE_URL`                                               | string **pooled** do Neon (passo 2)                                                | sem ela o deploy roda em modo arquivo (vazio na Vercel)                                |
| `OUTBOUND_RESEND_API_KEY`                                             | a mesma chave `re_…` do `.env.local`                                               | envia as campanhas **e** o link de login                                               |
| `OUTBOUND_FROM`                                                       | o mesmo do `.env.local` (`Luigi Choffe <…@bedreamy.com.br>`)                       | remetente verificado no Resend                                                         |
| `OUTBOUND_REPLY_TO`                                                   | o mesmo do `.env.local` (caixa que recebe respostas)                               |                                                                                        |
| `OUTBOUND_TEAM_EMAILS`                                                | `luigi@…,socio@…`                                                                  | allowlist do login: vírgulas, sem espaços, minúsculas; quem não está aqui não entra    |
| `OUTBOUND_SESSION_SECRET`                                             | 64 hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | assina o cookie (30 dias); trocar = todo mundo faz login de novo. Marcar **Sensitive** |
| `OUTBOUND_APP_URL`                                                    | `https://mork.bedreamy.com.br`                                                     | base dos links de login — tem de ser a URL que o time abre                             |
| `OUTBOUND_SEND_WINDOW` / `OUTBOUND_UTC_OFFSET` / `OUTBOUND_DAILY_CAP` | como no `.env.local` (vazio = defaults)                                            | só afetam o fio de saúde e as ações do console; o envio é da CLI                       |

**Não definir**: `NEXT_PUBLIC_SITE_ENV=production` (liberaria indexação do site duplicado e muda o comportamento das páginas — ADR-017), `OUTBOUND_AUTH_DISABLED` (só dev), `OUTBOUND_STORE_DIR` (sem sentido na Vercel). Não precisa de `NEXT_PUBLIC_SITE_URL`, GTM, CRM ou Turnstile.

Depois de salvar tudo: **Redeploy**.

## 4. Migrar o store local para o banco (uma vez, no PC do Luigi)

Momento: sem run em andamento — fora da janela 09:00–17:30, ou com `pnpm outbound:arm status` sem `pending`. (1º disparo real é seg 2026-08-31 09:05: migrar antes das 09:00 ou depois das 17:30.)

1. `.env.local` (raiz do repo): adicionar `OUTBOUND_DATABASE_URL=<string pooled do passo 2>`. A partir daqui **todos** os `pnpm outbound:*`, a tarefa agendada e o `pnpm dev` leem/gravam no banco; `.outbound/` vira backup congelado (não apagar).
2. `pnpm outbound:db migrate` → cria/confirma as tabelas (`outbound_documents`, `outbound_events`, `outbound_state`, `outbound_locks`). Idempotente.
3. `pnpm outbound:db status` → deve mostrar tudo zerado e `armada: não` (banco novo).
4. `pnpm outbound:db push` → copia contatos, empresas, campanhas, enrollments, envios, eventos, supressões, respostas, imports e o estado (armada/breaker) de `.outbound/` para o banco. **Uma vez só.** Se o banco já tiver dados o comando recusa; `push --confirm` **substitui** as coleções pelo store local — só com certeza.
5. Conferir: `pnpm outbound:db status`, `pnpm outbound:arm status` e `pnpm outbound:report` com os mesmos números de antes (armada SIM, campanha aprovada, 42 contatos, 16 enrollments).
6. Tarefa agendada: nada muda (`DreamyOutboundAuto` roda `pnpm outbound:auto` no repo e lê o `.env.local`). PC ligado e logado às 09:05 de dia útil continua obrigatório até a fase Vercel Cron (PRD §29.3).
7. Backup quando quiser: `pnpm outbound:db pull` → `.outbound-backup-<data>/` (ou `--dir <pasta>`), mesmo formato JSON do store. É PII: fora do git (ignorado pelo `.gitignore`).

## 5. Domínio mork.bedreamy.com.br

1. Vercel → projeto → Settings → **Domains** → digitar `mork.bedreamy.com.br` → **Add** (ambiente Production). A Vercel mostra o registro esperado: `CNAME` `mork` → `cname.vercel-dns.com`.
2. Hostinger → hPanel → **Domínios** → `bedreamy.com.br` → **DNS / Nameservers** → **Gerenciar registros DNS** → Adicionar: Tipo `CNAME` · Nome `mork` · Destino `cname.vercel-dns.com` · TTL padrão → **Adicionar registro**.
   - Não tocar nos registros existentes (MX, TXT SPF/DMARC, `resend._domainkey`, `send`): o CNAME em `mork` não interfere no e-mail de `bedreamy.com.br`.
   - Se a zona DNS estiver em outro lugar (Cloudflare etc.), criar o mesmo CNAME lá, sem proxy.
3. Vercel → Domains: esperar **Valid Configuration** (minutos a ~1 h); certificado TLS automático.
4. Abrir `https://mork.bedreamy.com.br/` → deve cair em `/interno/login`. `OUTBOUND_APP_URL` já aponta para esse host (passo 3).

Quer testar antes do DNS? `OUTBOUND_APP_URL=https://<projeto>.vercel.app` temporário + Redeploy, e voltar depois.

## 6. Primeiro login

1. `https://mork.bedreamy.com.br/interno/login` → digitar um e-mail da `OUTBOUND_TEAM_EMAILS` → enviar.
2. Abrir o e-mail (remetente `OUTBOUND_FROM`) → clicar no link (`/api/outbound/auth/callback?…`) → entra em `/interno/outbound` já logado. Sessão = cookie assinado, 30 dias, por navegador. Sair: `/interno/logout`.
3. Cada pessoa/dispositivo repete o fluxo (um link por navegador).

## 7. Checklist de verificação

1. Sem login: `https://mork.bedreamy.com.br/interno/outbound` → pede login (nunca mostra dados). `https://mork.bedreamy.com.br/api/outbound/…` → 401/redirect.
2. `https://mork.bedreamy.com.br/` → 307 → `/interno/outbound` → login (`OUTBOUND_PLATFORM_ONLY`).
3. Logado: Visão geral com os mesmos números do `pnpm outbound:report` do PC (armada, cap do dia, campanha, 42 contatos); abrir `/interno/outbound/construcao-nova-receita` (funil + copy renderizada), Contatos, Respostas, Atividade, Supressão.
4. Fio de saúde: armada **sim**, breaker fechado, `pending` 0, agendados órfãos 0 — igual ao `pnpm outbound:arm status`.
5. Pausar/retomar: **só em demo**, nunca na campanha real com envio agendado (pausar cancela os agendados do dia). Demo no hospedado (`?demo=1`) depende de haver dados de demo no deploy; se aparecer "store de demonstração vazio", testar no PC: `pnpm outbound:demo` → `pnpm dev` → `http://localhost:3000/interno/outbound?demo=1` → pausar → retomar.
6. Vercel → projeto → **Logs**: nenhum `server.request_error`; filtrar `outbound.` para ver ações do console.
7. `pnpm smoke --base https://mork.bedreamy.com.br` (opcional): foi escrito para o site — com a raiz redirecionando, as linhas de home (h1/canonical/JSON-LD/OG) falham por desenho; valem as de headers/CSP, robots (`Disallow: /`), sitemap vazio e 404. Smoke da plataforma = fase P5 (PRD §29.3).
8. Terça 2026-09-01 (dia seguinte ao 1º disparo): `pnpm outbound:report` no PC e o console batem (mesmo banco); `pnpm outbound:db status` mostra os envios.

## 8. Time — adicionar/remover pessoas; link que não chega

Adicionar ou remover:

1. Vercel → Settings → Environment Variables → `OUTBOUND_TEAM_EMAILS` → **Edit** → lista nova (vírgulas, sem espaços) → **Save**.
2. Deployments → último → **⋯ → Redeploy** (env só entra em deploy novo).
3. Remoção com efeito imediato: além de tirar da lista, gerar novo `OUTBOUND_SESSION_SECRET` → Redeploy → todas as sessões caem (o time faz login de novo). Sem trocar o secret, o cookie da pessoa pode valer até 30 dias.

Link não chegou:

1. O e-mail digitado está **exatamente** em `OUTBOUND_TEAM_EMAILS` (minúsculas, sem espaço, mesmo domínio — corporativo × pessoal)?
2. Spam / Promoções / quarentena do provedor. Remetente = `OUTBOUND_FROM`.
3. Resend → **Emails**: o envio para esse endereço aparece? _Delivered_? Se não aparece: `OUTBOUND_RESEND_API_KEY`/`OUTBOUND_FROM` faltando ou errados **no projeto Vercel** (não basta no `.env.local`) → corrigir → Redeploy.
4. Vercel → Logs: erro em `/interno/login` ou `/api/outbound/auth/callback`?
5. O link tem validade curta: pedir outro em vez de reaproveitar; abrir no mesmo navegador/dispositivo em que pediu.
6. Link abre mas não loga: `OUTBOUND_APP_URL` ≠ host em uso (ex.: pediu em `*.vercel.app`, link aponta para `mork.bedreamy.com.br`) → o cookie fica no outro host. Usar sempre a URL de `OUTBOUND_APP_URL`.
7. Navegador bloqueando todos os cookies (modo restrito/anônimo com bloqueio): a sessão é cookie first-party — liberar para o domínio.

## 9. Notas

- **Plano Vercel**: Hobby funciona (1 membro; sem convite de membros — por isso o login próprio, ADR-024). Os termos reservam Hobby a uso pessoal/não comercial: se a Vercel cobrar, migrar para **Pro** (US$ 20/mês) — sem mudança de código.
- **Deployment Protection**: manter **desligada** em Production ("Vercel Authentication" só aceita membros da Vercel e bloquearia o time). Previews podem ficar protegidos.
- **Neon Free**: o compute dorme após inatividade (1º acesso do dia demora ~1 s) e tem 0,5 GB — o outbound usa KB.
- **Site marketing**: continua no repo, atrás do redirect da raiz e noindex, até a fase de remoção (PRD §29.3, P5). O site oficial é o do sócio.
- **Volta atrás**: remover `OUTBOUND_DATABASE_URL` do `.env.local` devolve os CLIs ao `.outbound/` (congelado no momento do `push`); antes disso, `pnpm outbound:db pull` para não perder o que aconteceu no banco.
- **Push no GitHub**: cada push em `main` gera deploy novo automaticamente (o CI do GitHub continua valendo).
