# Architecture Decision Records — Dreamy Site

Formato: Decision / Reason / Alternatives / Date / Status. Novas decisões são adicionadas ao final; decisões revertidas recebem status "Superseded by ADR-xxx".

---

# ADR-001

Decision:
Usar Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS 4, com pnpm.

Reason:
Stack recomendada pelo PRD (§66). Versões estáveis disponíveis na inicialização (2026-08-17). App Router permite Server Components por padrão, Metadata API, `sitemap.ts`/`robots.ts`, OG images nativas e Route Handlers para o lead.

Alternatives:
Framer (plataforma atual) — não permite a arquitetura de conversão/analytics exigida; Astro — sem necessidade, PRD define Next.js.

Date:
2026-08-17

Status:
Accepted.

---

# ADR-002

Decision:
Fixar TypeScript 5.9.x (não 6.x/7.x) e ESLint 9.x (`eslint-config-next` 16.3).

Reason:
`typescript-eslint` (usado por `eslint-config-next`) declara suporte a `typescript >=4.8.4 <6.1.0`; TS 7 (port nativo) é `latest` no npm mas ainda sem suporte na cadeia de lint. Evita instabilidade sem ganho para o projeto.

Alternatives:
TypeScript 7.0.2 (latest), TypeScript 6.0.3.

Date:
2026-08-17

Status:
Accepted. Reavaliar quando `typescript-eslint` suportar TS ≥ 6.1.

---

# ADR-003

Decision:
Usar `motion` 13.x (`motion/react`) com `LazyMotion` + componentes `m` e features `domAnimation`.

Reason:
Recomendado pelo PRD (§66). O único breaking change de 13.0 (remoção da dependência opcional `@emotion/is-prop-valid`) não afeta o projeto. `LazyMotion` reduz o bundle. Animações do Hero e dos diagramas usam CSS/SVG puro (sem JS) para não pesar no LCP; Motion é usado em reveals/stagger fora da dobra.

Alternatives:
Somente CSS + IntersectionObserver (menor bundle, mais código manual); GSAP (licença/peso).

Date:
2026-08-17

Status:
Superseded by ADR-016 (Motion removido da V1: reveals em CSS + IntersectionObserver; Hero e diagramas já eram SVG/CSS).

---

# ADR-004

Decision:
Tipografia: **Instrument Sans** (família principal — texto/UI) + **Urbanist** (família secundária — display/títulos), ambas via `next/font/google` (self-hosted no build, subset latin, `display: swap`).

Reason:
Não existe arquivo/licença de "tipografia oficial Dreamy" nos assets. O site atual usa Urbanist para títulos (personalidade visual a preservar, PRD §55) e Instrument Sans consta entre as fontes já usadas. Ambas são open-source (OFL). Instrument Sans é neutra, legível em 16–18 px e evita o aspecto de "template de startup de IA" associado à Geist (sugerida pelo PRD como fallback). Satoshi (body atual) não é open-source nem hospedada no Google Fonts. Máximo de duas famílias, conforme PRD §57; troca centralizada em `src/styles/fonts.ts`.

Alternatives:
Geist única família (sugestão do PRD); Urbanist única família; Urbanist + Satoshi (self-host, licença Fontshare).

Date:
2026-08-17

Status:
Accepted. Se a Dreamy fornecer tipografia oficial licenciada, substituir em `src/styles/fonts.ts`.

---

# ADR-005

Decision:
`--brand-primary: #46EB7E`. Gradiente do símbolo `#41E97A → #6BFA9C`. Base escura `#0B0B0C` / superfícies `#131316`–`#1B1B1F` / off-white `#F7F8F8`.

Reason:
PRD §56 proíbe adivinhar o verde. `#46EB7E` é simultaneamente o token de cor do site Framer atual e a segunda cor exata mais frequente no PNG do logo oficial (`DREAMY_INST_v2.pptx` → `image2.png`; a mais frequente é `#41E97A`, um passo mais escuro no mesmo gradiente). Detalhes em `docs/AUDIT-SITE-ATUAL.md`. Contraste do verde sobre `#0B0B0C` ≈ 12,7:1 (texto e botões com texto escuro aprovados em AA/AAA). Sobre fundos claros o verde não passa AA → não usar verde como texto em superfície clara.

Alternatives:
`#1ED760` (verde escuro do deck), `#41E97A`.

Date:
2026-08-17

Status:
Accepted.

---

# ADR-006

Decision:
Logo em `public/brand/` a partir dos PNGs oficiais (horizontal e símbolo), otimizados; wordmark para fundo escuro renderizado a partir do PNG oficial com inversão do wordmark cinza (`#333333`) para off-white via processamento de imagem sem alterar o símbolo. Solicitar SVG oficial.

Reason:
Não há SVG nem versão para fundo escuro nos assets. Redesenhar o logo seria inventar identidade. Inverter apenas a luminância do wordmark preserva a forma oficial.

Alternatives:
Wordmark como texto HTML (fonte diferente da oficial), aguardar SVG (bloquearia o header).

Date:
2026-08-17

Status:
Accepted (provisório até SVG oficial).

---

# ADR-007

Decision:
Conteúdo em V1: soluções como objetos TypeScript tipados; cases e insights em MDX (frontmatter validado com Zod, renderizado com `next-mdx-remote/rsc`); copy das páginas em `src/content/*.ts`; sem CMS.

Reason:
PRD §84 (MDX + Git; não adicionar CMS "para dizer que existe"). Volume inicial pequeno. Schemas Zod garantem `approved`/`status` e permitem migração para Sanity/Contentful/Payload trocando apenas os loaders (`src/lib/content`).

Alternatives:
Headless CMS já na V1; Contentlayer (descontinuado); `@next/mdx` com imports estáticos.

Date:
2026-08-17

Status:
Accepted.

---

# ADR-008

Decision:
Gates de publicação: `/cases` e a seção de cases da Home só existem com ≥ 1 case `approved: true`; `/insights` só com ≥ 3 insights `status: published`; seção de prova só com métricas `verified` ou logos `authorized`. Rotas ocultas retornam 404 e ficam fora do sitemap e da navegação.

Reason:
PRD §13, §17, §18, §33, §83: nunca lançar seção vazia nem conteúdo fictício. Hoje não há conteúdo aprovado.

Alternatives:
Páginas com "em breve" (placeholder — proibido pelo PRD).

Date:
2026-08-17

Status:
Accepted.

---

# ADR-009

Decision:
Analytics exclusivamente via GTM, com Consent Mode v2 padrão `denied`, banner de consentimento próprio (necessário/analytics/marketing) e `page_view` disparado pelo app em toda navegação. GA4/Meta/LinkedIn configurados dentro do GTM (documentado em `docs/TRACKING.md`).

Reason:
PRD §43–§45, §72–§73. Evita instalação dupla de GA4, mantém PII fora das tags e permite trocar/adicionar tags sem deploy. `page_view` manual evita duplicidade e cobre navegação SPA.

Alternatives:
`@next/third-parties` (não controla consent default antes do carregamento); CMP de terceiros (dependência/custo).

Date:
2026-08-17

Status:
Accepted.

---

# ADR-010

Decision:
Sem `proxy.ts`/middleware em V1. Headers de segurança e redirects em `next.config.ts`; CSP em `Report-Only` por padrão, `enforce` via `CSP_ENFORCE=true`.

Reason:
Manter todas as páginas 100% estáticas (PRD §68). CSP com nonce exigiria renderização dinâmica. PRD §76 pede testar CSP antes do enforcement definitivo.

Alternatives:
CSP com nonce via `proxy.ts` (páginas dinâmicas).

Date:
2026-08-17

Status:
Accepted.

---

# ADR-011

Decision:
Lead pipeline: Route Handler `POST /api/leads` → validação Zod → `LeadService` com adapters `CRMProvider` (`webhook` | `none`), `NotificationProvider` (`resend` via REST/fetch | `none`), `SchedulingProvider` (URL configurável), `LeadStore` (log). Rate limit e idempotência in-memory com interfaces trocáveis. Turnstile opcional por env.

Reason:
PRD §41–§42, §75. Sem SDKs para reduzir dependências; provedores trocáveis por env sem alterar o formulário. Falha do CRM é erro observável; falha de e-mail não destrói lead entregue ao CRM.

Alternatives:
Server Actions (menos controle de status HTTP/idempotência), SDK do CRM específico.

Date:
2026-08-17

Status:
Accepted. Atualização 2026-08-18: adapters `createKvRateLimiter` / `createKvIdempotencyStore` (Redis via REST — Upstash/Vercel Marketplace, sem SDK) entram automaticamente quando `KV_REST_API_URL/TOKEN` (ou `UPSTASH_REDIS_REST_*`) existem; falha do store é fail-open (lead nunca é bloqueado/perdido por indisponibilidade do Redis). Sem as variáveis, memória por instância.

---

# ADR-012

Decision:
OG images geradas no build com `ImageResponse` (`opengraph-image.tsx`) e fonte Urbanist local (`src/assets/fonts`), com fallback estático em `public/brand/og-default.png`.

Reason:
PRD §47 exige OG em todas as páginas; geração nativa mantém consistência de marca sem ferramenta externa.

Alternatives:
Uma única imagem estática para todas as páginas.

Date:
2026-08-17

Status:
Accepted.

---

# ADR-013

Decision:
Números de contato/jurídicos: apenas o WhatsApp `+55 11 94879-3233` entra como padrão configurável (já público no site atual e no deck institucional); CNPJ, razão social, e-mail e endereço ficam vazios (`null`) e as UIs os omitem até serem preenchidos em `src/config/site.ts`.

Reason:
PRD §109 (não inventar valores) e §2 (não inventar informações comerciais). O WhatsApp é dado público existente, não inventado, mas deve ser confirmado antes do lançamento.

Alternatives:
Placeholder visível (proibido).

Date:
2026-08-17

Status:
Accepted.

---

# ADR-014

Decision:
Base visual clara (off-white `#F7F8F8` + quase preto `#0B0B0C` + verde `#46EB7E`) com **seções escuras deliberadas** (Soluções, Fit, CTA final, Footer, blocos de mensagem) via `data-theme="dark"`. Tokens semânticos permitem inverter o site inteiro para tema escuro alterando um atributo no `<html>`.

Reason:
PRD §56 define a base "quase preto + off-white + verde" e §55 pede preservar o "contraste escuro" e a personalidade do site atual — que é claro, com blocos escuros. Tema 100% escuro aproximaria o site do "template genérico de startup de IA" (proibido em §2/§54); o público (fundadores/diretores não técnicos) lê melhor em base clara. A alternância clara/escura cria o ritmo visual pedido em §59.

Alternatives:
Site 100% escuro; site 100% claro sem seções escuras.

Date:
2026-08-17

Status:
Accepted — **decisão a confirmar com a Dreamy** (troca é trivial: `data-theme="dark"` no `<html>` + ajuste do Hero).

---

# ADR-015

Decision:
Schema do lead em `zod/mini` (tree-shakeable) com `z.config({ jitless: true })`; schemas de conteúdo (server-only) permanecem em `zod` clássico.

Reason:
O bundle clássico do Zod (~309 KB / 75 KB gzip) entrava inteiro na página de contato; `zod/mini` reduz o chunk do formulário para ~62 KB total. O modo JIT do Zod 4 usa `new Function`, violando a CSP sem `'unsafe-eval'` (PRD §76); `jitless` resolve.

Alternatives:
Validador manual duplicado (risco de divergência client/server); manter Zod clássico com `'unsafe-eval'` na CSP (pior segurança).

Date:
2026-08-18

Status:
Accepted.

---

# ADR-016

Decision:
Sem biblioteca de animação em V1. Reveals com IntersectionObserver + transições CSS (`data-reveal`), Hero e diagramas com SVG/CSS puro; conteúdo servido sempre visível (sem JS nada fica oculto).

Reason:
PRD §71 ("não carregar bibliotecas enormes para uma animação") e §60. Motion adicionava ~30 KB gzip e deixava o conteúdo com `opacity:0` no HTML servido (invisível se a hidratação falhar). A abordagem CSS protege o LCP (elementos já visíveis na carga não animam) e mantém `prefers-reduced-motion`.

Alternatives:
Motion com `LazyMotion` (ADR-003).

Date:
2026-08-18

Status:
Accepted. Reintroduzir Motion apenas se surgir animação que justifique (ex.: line drawing orquestrado por scroll).

---

# ADR-017

Decision:
Modo "produção" (indexação liberada, sitemap com URLs, sem `X-Robots-Tag: noindex`, HSTS) é opt-in explícito via `NEXT_PUBLIC_SITE_ENV=production`. Não é inferido de `VERCEL_ENV`.

Reason:
Na Vercel, o deploy da branch `main` roda com `VERCEL_ENV=production` mesmo servido só em `*.vercel.app`. Inferir produção daí deixaria o site novo indexável antes da migração de domínio (PRD §53, §108), duplicando conteúdo do site atual. Com opt-in explícito, o go-live é um passo consciente da checklist (`docs/LAUNCH-CHECKLIST.md`).

Alternatives:
Inferir de `VERCEL_ENV` (risco de indexação precoce); checar host em runtime (não cobre `robots.txt`/`sitemap` estáticos e complica o build).

Date:
2026-08-18

Status:
Accepted.

---

# ADR-018

Decision:
Passo de design "Apple × Spotify" (2026-08-18), a pedido da Dreamy, mantendo copy do PRD intacta:

- **Assinatura**: o hero é um "sistema vivo" derivado do símbolo da marca — os três discos translúcidos do logo atrás do núcleo, órbita pontilhada com brilho percorrendo o anel, conectores com pacotes de luz fluindo (entradas → empresa → IA/receita), pulso lento no núcleo; nós com ícones em pílulas. Mesmo vocabulário no `HubDiagram` (agente + integrações) e no `AmbientDiscs` da faixa de CTA. Tudo SVG + CSS (sem JS, sem lib), `prefers-reduced-motion` respeitado; animações contínuas começam depois do primeiro paint (LCP protegido) e sem filtros SVG/backdrop-blur sobre camadas animadas.
- **Diagramas de fluxo** (`FlowDiagram`): vertical vira "rail" (marcadores centrados numa linha contínua, rótulos alinhados à esquerda, último passo em pílula verde; `numbered` para o diagnóstico); horizontal vira pílulas ligadas por fio fino. Substitui as setas/chips desalinhados.
- **Cards de solução**: cada card é item de `grid-rows-subgrid` (meta · título · diagrama · CTA) — diagramas começam na mesma altura e CTAs terminam alinhados; painel do diagrama centralizado; brilho suave no hover.
- **Tipografia/tokens**: display 38→72 px (≈65 px em 1440), tracking −0.032em, leading 1; `--shadow-glow-soft`; `surface-sheen` (realce superior sutil só em superfícies escuras); botão primário com hover scale 1.02 + glow.
- `Reveal` remove o atributo após a entrada (o elemento volta às próprias transições de hover).

Reason:
O usuário pediu um "tapa de design" (referência: precisão da Apple + energia/pílulas/verde da Spotify, combinando com o logo) antes de hospedar; os gráficos do hero eram genéricos e os campos dos cards ficavam desalinhados. A linguagem visual passa a vir do próprio símbolo da Dreamy (discos sobrepostos), o que a torna própria e não templável.

Alternatives:
Biblioteca de animação (ADR-016 mantém sem lib); grid faint no fundo do hero (removido — default genérico); `content-visibility: auto` nas seções (testado, sem ganho de LCP e com risco de salto na barra de rolagem — descartado).

Date:
2026-08-18

Status:
Accepted. Lighthouse mobile home ≥ 94–95 (LCP simulado ~3,0 s vs baseline medida nas mesmas condições 3,1–3,6 s); e2e 56 passed; axe limpo.

---

# ADR-019

Decision:
V1 do Dreamy Outbound opera 100% local: store em arquivos JSON (`.outbound/`, gitignored, escrita atômica) e sincronização de eventos por polling da API do Resend (`GET /emails/:id`), sem banco de dados e sem webhooks até a fase de deploy. Interfaces (`OutboundStore`, `ResendClient`) isolam a troca futura por Postgres + webhooks (PRD-EMAIL-OUTBOUND §22, fases de produção).

Reason:
O usuário quer operar assim que entregar a lista, sem provisionar infra externa (Vercel ainda sem projeto; Neon exigiria conta). Os volumes da rampa (15–80 envios/dia, PRD-EMAIL-OUTBOUND §17) cabem com folga em arquivos JSON; o polling cobre delivered/bounced/complained/opened/clicked sem URL pública.

Alternatives:
Postgres gerenciado (Neon/Vercel — exige conta + deploy antes do primeiro envio); Upstash Redis (inadequado para consultas analíticas); SQLite (`better-sqlite3` = dependência nativa nova; `node:sqlite` experimental).

Date:
2026-08-27

Status:
Accepted. Superseded parcialmente por ADR-023 (2026-08-29): Postgres passa a ser a fonte de verdade quando `OUTBOUND_DATABASE_URL` existe; o store em arquivos permanece para dev/demo. Polling de eventos continua até a fase de webhooks (PRD-EMAIL-OUTBOUND §29.3).

---

# ADR-020

Decision:
Automação armada: após (a) aprovação de copy por campanha (`outbound:campaign approve --confirm`, com lint bloqueante) e (b) arming explícito único do usuário (`outbound:arm arm --confirm`, registrado no store), `outbound:auto` (tarefa agendada local, dias úteis 09:05) dispara e-mails reais sem confirmação por envio. Emenda o protocolo do PRD-EMAIL-OUTBOUND §20 (que previa confirmação por disparo), a pedido explícito do usuário (2026-08-27).

Reason:
O usuário pediu operação automática ("eu só envio a lista"). As salvaguardas que permanecem são estruturais, não processuais: rampa/caps e janela aplicados pelo motor, lint de copy bloqueante, verificação de lista obrigatória (override só com `--assume-ok --confirm`), supressão checada a cada plano, e circuit breaker automático (bounce ≥ 3% pausa a campanha; 1 complaint pausa tudo; religar exige `reset-breaker --confirm` humano).

Alternatives:
Confirmação por disparo (fluxo original do PRD §20 — rejeitado pelo usuário); envio via cron remoto (não há deploy).

Date:
2026-08-27

Status:
Accepted.

---

# ADR-021

Decision:
Descadastro na V1 local: opt-out por resposta (processado no dia com `outbound:reply --suppress`, supressão global permanente) + header `List-Unsubscribe: <mailto:...>` em todo envio. One-click RFC 8058 (endpoint HTTPS + `List-Unsubscribe-Post`) fica obrigatório na fase de deploy — antes de escalar além da rampa.

Reason:
Sem URL pública não existe endpoint HTTPS. Abaixo de 5.000 msgs/dia o one-click não é exigido por Gmail/Yahoo; a LGPD exige opt-out fácil e honrado — atendido por resposta + supressão permanente + parada imediata da sequência. O e-mail final da sequência carrega linha humana de opt-out.

Alternatives:
Esperar o deploy para começar (atrasa o objetivo); serviço externo de unsubscribe (dependência e domínio de terceiros em cold e-mail).

Date:
2026-08-27

Status:
Accepted. Superseder parcial planejado: one-click HTTPS na fase de produção.

---

# ADR-022

Decision:
Parsers próprios de CSV (RFC 4180, autodetecção `,`/`;`) e XLSX (ZIP + `node:zlib`, sharedStrings/inlineStr) em `src/lib/outbound/parse.ts`, zero dependências novas. Fallback documentado: exportar CSV do Clay se um `.xlsx` específico não parsear (o parser falha com mensagem orientando isso).

Reason:
Cultura do repo (ADR-007/011): dependência nova só com justificativa forte. `exceljs`/`xlsx` trazem árvore grande para ler uma planilha tabular simples; o formato exportado pelo Clay/Excel é previsível e os testes cobrem stored/deflate, entidades e colunas puladas.

Alternatives:
`exceljs` (pesado), `xlsx`/SheetJS (histórico de CVEs, licenciamento da versão OSS), exigir só CSV (atrito para o usuário, que recebe .xlsx).

Date:
2026-08-27

Status:
Accepted.

---

# ADR-023

Decision:
Persistência do outbound em Postgres gerenciado (Neon, criado pela aba Storage do projeto Vercel — integração Marketplace, free tier), acessado com `@neondatabase/serverless` pela env `OUTBOUND_DATABASE_URL` (connection string POOLED). `openStore()` escolhe o adapter pela presença da env: com ela, `store-pg.ts` (tabelas `outbound_documents`, `outbound_events`, `outbound_state`, `outbound_locks` — coleções como documentos JSON, eventos append-only, estado armed/breaker e lock de operação no próprio banco); sem ela, o store em arquivos (`.outbound/`) continua valendo — dev, demo e fallback. Comandos: `pnpm outbound:db migrate` (cria/confirma tabelas, idempotente), `push [--confirm]` (copia o store local para o banco, uma vez; recusa sobrescrever banco com dados sem `--confirm`), `pull [--dir]` (backup banco → JSON), `status` (contagens). Testes do adapter rodam com Postgres embutido (`@electric-sql/pglite`, devDependency). CLIs locais (incluindo a tarefa agendada) e o console na Vercel apontam para o MESMO banco.

Reason:
O pivô de 2026-08-29 (PRD-EMAIL-OUTBOUND §29) transforma o console num serviço hospedado com acesso do time — arquivos locais não são compartilháveis nem persistem em serverless. Neon pela Storage da Vercel dispensa conta/billing separados e injeta a conexão no projeto; o driver serverless fala HTTP/WebSocket (funciona em funções de curta duração, sem pool próprio) e a string pooled (PgBouncer) absorve conexões simultâneas de console + CLIs. Modelo documento-por-coleção preserva os tipos e chamadores do store em arquivos (ADR-019) — zero mudança de modelo de dados. Manter o store em arquivos preserva `pnpm dev`/demo sem banco e o caminho de saída (`pull`). pglite dá testes reais de SQL sem Docker nem serviço externo no CI. Duas dependências novas, ambas justificadas (ADR-011: dependência só com motivo forte).

Alternatives:
Continuar em arquivos + Vercel Blob (sem transações nem consultas; concorrência console × CLI); Upstash Redis (já rejeitado no ADR-019 — sem consultas analíticas); Supabase (segunda plataforma/conta; auth própria redundante); SQLite/Turso (fora da Storage da Vercel, driver extra); ORM (Drizzle/Prisma — camada a mais para meia dúzia de tabelas; SQL versionado é suficiente); testes contra Neon real (segredo no CI, lento, flaky).

Date:
2026-08-29

Status:
Accepted. Supersede parcialmente ADR-019: o banco é a fonte de verdade quando `OUTBOUND_DATABASE_URL` existe; o store em arquivos permanece para dev/demo.

---

# ADR-024

Decision:
Autenticação do console hospedado por **link mágico**: `/interno/login` recebe um e-mail; se estiver na allowlist `OUTBOUND_TEAM_EMAILS` (separada por vírgulas), o app envia pelo Resend (mesma conta do outbound) um link assinado e de validade curta para `/api/outbound/auth/callback`, que grava um cookie de sessão assinado com HMAC (`OUTBOUND_SESSION_SECRET`; HttpOnly, Secure, SameSite=Lax; 30 dias). Guard em `src/proxy.ts` sobre `/interno/*` e `/api/outbound/*` (exceto as rotas de auth); `/interno/logout` encerra a sessão. `OUTBOUND_APP_URL` define a base dos links; `OUTBOUND_AUTH_DISABLED=true` desliga o guard somente fora de produção (dev/testes). Sem provedor externo, sem senha, sem tabela de usuários: estar na allowlist é o cadastro. Revogação: remover da allowlist (+ trocar `OUTBOUND_SESSION_SECRET` para derrubar sessões vivas) e redeploy.

Reason:
O time precisa entrar por e-mail sem conta em serviço nenhum, e o projeto Vercel é Hobby (um membro; sem convite de membros): a **Vercel Authentication** (Deployment Protection) só aceita membros da Vercel, não serve ao time e já fora rejeitada como mecanismo primário no PRD-EMAIL-OUTBOUND §16 por bloquear rotas públicas futuras (webhook, descadastro). A **senha compartilhada** proposta no PRD §16/§19 (`OUTBOUND_DASHBOARD_PASSWORD`) não identifica quem fez cada ação (as Server Actions mutam PII), vaza por chat e exige rotação coletiva. Um provedor de identidade (Auth.js/Clerk/Auth0) adicionaria dependência, conta e configuração para um time de poucas pessoas. O link mágico reaproveita o Resend já presente (domínio `bedreamy.com.br` verificado) e a assinatura HMAC é nativa (sem dependência). Reverte de forma delimitada o ADR-010 ("sem proxy.ts"): o matcher cobre apenas `/interno/*` e `/api/outbound/*`; as páginas do site continuam estáticas e fora do guard.

Alternatives:
Vercel Authentication/Deployment Protection (exige membros Vercel/plano; bloquearia webhooks); senha única de time em env (PRD §16 — sem identidade individual, rotação coletiva); Auth.js/Clerk/Auth0 (dependência e conta externas para 2–3 usuários); Basic Auth (sem logout, credenciais em cada request, mesma fraqueza da senha única); Cloudflare Access (proxy de terceiro na frente da Vercel, outro painel).

Date:
2026-08-29

Status:
Accepted. Emenda parcialmente ADR-010 (escopo do guard) e substitui a proposta de auth do PRD-EMAIL-OUTBOUND §16 / §19 item 4.
---

# ADR-025

Decision:
CRM piloto por cima do outbound (PRD-EMAIL-OUTBOUND §29): sete coleções ADITIVAS no store duplo (`deals`, `notes`, `tasks`, `demands`, `agentActivities`, `briefings`, `settings` — arquivo e Postgres via `outbound_documents`, zero DDL). Pipeline com 8 estágios: "novo/contatado/respondeu" derivados do outbound por `reconcileDeals` (puro, idempotente, forward-only, jamais escreve nas coleções do motor); de "reuniao_marcada" em diante o movimento é humano (`applyStageMove`, piso no `autoStage`, motivo obrigatório em perdido, data obrigatória em reunião). Reunião NÃO é entidade: é estágio com `stageHistory` append-only, que alimenta a métrica norte (geradas/realizadas). Tarefas e notas append-only, com a regra do interessado (`ensureFollowUpTask` na mesma transação do reply). Fila de demandas console → CLI (`outbound:demandas`; transições validadas em `demands-core.ts`, resolução obrigatória em concluída/recusada, cancelamento só de pendente). IA por fetch direto (`claude-sonnet-5`, `OUTBOUND_ANTHROPIC_API_KEY`; 503 sem chave; demo com conteúdo simulado rotulado) com gate humano absoluto — nunca envia, nunca grava classificação, nunca move estágio — e prompts sem PII (`redactEmails`; só agregados, primeiro nome, cargo, indústria). `WorkspaceSettings` singleton de APRESENTAÇÃO (nunca alimenta copy, assinatura ou motor). Time de subagentes em `.claude/agents/` (verbo=copy, garimpo=leads/ICP, trato=respostas/CRM, forja=plataforma; teto de 5 — 5ª vaga MIRA reservada; demissão só com autorização do Luigi).

Reason:
Ordem do Luigi (2026-08-30): a plataforma é o piloto do CRM que a Dreamy vende; o MORK é o produto e a validação é ser vendido a outro cliente. O desenho protege o que já opera (1º disparo real 2026-08-31: motor de envio intocado, tudo aditivo), preserva os gates do ADR-020 (armar/disparar/aprovar só na CLI, com humano) e torna cada automação derivável e reversível (reconcile idempotente, históricos append-only, IA só sugere).

Alternatives:
CRM externo (Pipedrive/HubSpot — PII fora de casa e integração maior que o piloto); coleção Meeting separada (duplicaria o stageHistory); SDK da Anthropic (dependência desnecessária para um fetch); IA com autonomia de escrita (violaria o gate humano e o controle de PII); tabelas Postgres dedicadas por coleção (DDL e migrações sem ganho no volume atual).

Date:
2026-08-30

Status:
Accepted. Complementa ADR-019/023 (mesmas garantias de store para as coleções novas) e preserva integralmente ADR-020.
