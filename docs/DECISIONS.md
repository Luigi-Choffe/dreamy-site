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
Accepted. Em produção multi-instância, considerar Upstash Ratelimit (interface já prevista).

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
