# SEO-MIGRATION — Migração do site Framer para o novo site (PRD §51–§53)

## Situação atual (auditoria 2026-08-17)

- Plataforma: Framer. `sitemap.xml` lista apenas `https://www.dreamy.app.br/`.
- `robots.txt`: `Allow: /`.
- Única URL indexável conhecida: `/`. Seções internas são âncoras (`#form`, `#tools`, `#features`, `#integrations`) — não são URLs indexadas.
- Host canônico atual: `www.dreamy.app.br` (mantido — PRD §52).
- Pendente (requer acesso): Google Search Console (páginas indexadas, consultas, backlinks) e ferramenta de backlinks. Registrar aqui quando verificado.

## Mapa de redirects

Arquivo: `docs/redirect-map.csv` (formato `old_url,new_url,status`).

| old_url                   | new_url                       | status      | implementação                                                                                                  |
| ------------------------- | ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `https://dreamy.app.br/*` | `https://www.dreamy.app.br/*` | 301         | DNS/host (Vercel: domínio apex → redirect para www) + `next.config.ts` redirects com `has: host` (redundância) |
| `http://*`                | `https://*`                   | 301         | host (HTTPS obrigatório)                                                                                       |
| `/`                       | `/`                           | 200         | mantida                                                                                                        |
| `/#form`                  | `/contato`                    | client-side | `src/components/analytics/LegacyHashRedirect.tsx` (hash não chega ao servidor)                                 |
| `/#tools`                 | `/solucoes`                   | client-side | idem                                                                                                           |
| `/#features`              | `/#como-trabalhamos`          | client-side | idem                                                                                                           |
| `/#integrations`          | `/solucoes/agentes-de-ia`     | client-side | idem                                                                                                           |

Regra: nunca remover URL indexada relevante sem redirect. Como só `/` está indexada, o risco de perda é baixo; se o Search Console revelar outras URLs (ex.: `/page-2`), adicionar ao CSV e ao `next.config.ts`.

## Novo mapa de URLs

`/`, `/solucoes`, `/solucoes/nova-receita-digital`, `/solucoes/sistemas-sob-medida`, `/solucoes/agentes-de-ia`, `/sobre`, `/contato`, `/privacidade`, `/cookies`, (`/cases`, `/cases/[slug]` — quando houver case aprovado), (`/insights`, `/insights/[slug]` — quando houver ≥ 3 publicados).

## Preview/Staging

Fora de produção (`NEXT_PUBLIC_SITE_ENV !== 'production'` — o valor não é inferido de `VERCEL_ENV`, ADR-017): `<meta name="robots" content="noindex, nofollow">`, `robots.txt` com `Disallow: /`, header `X-Robots-Tag: noindex, nofollow`. Nenhum sitemap é servido com URLs de preview.

## Checklist de lançamento (Fase 8)

1. Definir `NEXT_PUBLIC_SITE_URL=https://www.dreamy.app.br` e `NEXT_PUBLIC_SITE_ENV=production` no ambiente de produção.
2. Apontar DNS: `www` → host de produção; apex `dreamy.app.br` → redirect 301 para `www`.
3. Confirmar HTTPS + HSTS ativos; testar `http://dreamy.app.br/`, `https://dreamy.app.br/`, `http://www.dreamy.app.br/`.
4. Validar `https://www.dreamy.app.br/robots.txt` e `/sitemap.xml` — atalho: `pnpm smoke --base https://www.dreamy.app.br --expect production --redirects` cobre 3 e 4 e o `redirect-map.csv`.
5. Search Console: verificar propriedade (domínio), enviar sitemap, solicitar indexação das páginas principais, monitorar Cobertura/404.
6. Validar structured data (Rich Results Test / Schema validator) em `/`, `/solucoes/*`.
7. Validar OG (LinkedIn Post Inspector, WhatsApp).
8. Remover GA4 direto do site antigo ao desligar o Framer (evitar dupla contagem no período de transição).
9. Monitorar 404 e consultas por 30 dias (Fase 9).
