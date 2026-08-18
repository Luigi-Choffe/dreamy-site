# LAUNCH CHECKLIST — Dreamy Site (PRD §107–§108)

Marque cada item antes de apontar o domínio. "Auto" = já garantido pelo código/testes; "Config" = depende de configuração/decisão da Dreamy; "Manual" = verificação humana no lançamento.

## Conteúdo

- [x] Copy final do PRD aplicada sem alteração (Auto — `docs/COPY-REVIEW.md` lista o que é autoral)
- [ ] Copy autoral revisada pela Dreamy (Manual — `docs/COPY-REVIEW.md`)
- [ ] Cases aprovados por escrito e `approved: true` (Config — `docs/CONTENT-SOURCES.md`); sem case, seção/rota ficam ocultas (Auto)
- [ ] Logos autorizados registrados em `src/content/proof.ts` (Config); sem logo, nada é exibido (Auto)
- [ ] Métricas comprovadas com fonte (Config); `pnpm content:check` bloqueia métrica sem aprovação (Auto)
- [ ] Contatos corretos: WhatsApp confirmado, e-mail/CNPJ/endereço/LinkedIn preenchidos em `src/config/site.ts` (Config)
- [ ] Políticas de Privacidade e Cookies revisadas juridicamente (Manual — `src/content/legal/*`)
- [ ] Insights: publicar somente com ≥ 3 artigos revisados (`status: published`) (Config); rascunhos existentes em `src/content/insights/` estão em `review`
- [x] Sem depoimentos, NoCode/LowCode, consultoria gratuita, placeholders (Auto — `pnpm content:check`)

## SEO

- [x] Titles/descriptions/canonicals por página (Auto — testes)
- [x] Sitemap e robots nativos; preview/staging noindex (Auto)
- [x] Structured data sem review/rating (Auto — teste e2e)
- [x] OG images geradas por página (Auto)
- [ ] `NEXT_PUBLIC_SITE_ENV=production` e `NEXT_PUBLIC_SITE_URL=https://www.dreamy.app.br` no ambiente de produção (Config)
- [ ] Redirect apex → www e HTTP → HTTPS ativos no host/DNS (Config — `docs/SEO-MIGRATION.md`)
- [ ] Search Console: propriedade verificada, sitemap enviado (Manual)
- [ ] Rich Results Test / validador de schema em `/` e `/solucoes/*` (Manual)
- [ ] LinkedIn Post Inspector / WhatsApp preview do OG (Manual)

## Conversão

- [x] Formulário funciona ponta a ponta (Auto — e2e); estados de erro/retry (Auto)
- [ ] CRM configurado (`CRM_PROVIDER=webhook`, `CRM_WEBHOOK_URL`, `CRM_API_KEY`) e lead de teste recebido (Config/Manual)
- [ ] E-mail de leads (`EMAIL_PROVIDER=resend`, chave, `LEADS_NOTIFICATION_EMAIL`, `LEADS_NOTIFICATION_FROM` com domínio verificado) e e-mail de teste recebido (Config/Manual)
- [ ] Booking (`NEXT_PUBLIC_BOOKING_URL`) (Config — opcional)
- [x] UTMs preservadas até o lead (Auto — e2e)
- [x] Lead scoring server-side, configurável (Auto — testes)
- [ ] Turnstile (opcional) — só se houver spam (Config)

## Analytics

- [ ] `NEXT_PUBLIC_GTM_ID` definido (Config)
- [ ] Container GTM configurado conforme `docs/TRACKING.md`: GA4 config `send_page_view=false`, tag de `page_view` no evento custom, eventos, consentimento por tag (Config)
- [ ] Meta Pixel e LinkedIn Insight Tag dentro do GTM com consentimento (Config)
- [x] Consent Mode v2 default denied + banner (Auto — e2e)
- [x] Nenhuma PII no dataLayer (Auto — teste unitário + e2e)
- [ ] Preview do GTM: validar cada evento uma vez (Manual — PRD §94)
- [ ] Remover GA4 direto (`G-5K32R2LMG3`) do site antigo ao desligar o Framer (Manual)

## Qualidade

- [x] Lighthouse mobile ≥ 90/95/95/95 (Auto — `docs/qa/lighthouse/`)
- [x] Mobile/desktop revisados; sem overflow em 320–1920 (Auto — `pnpm qa:screenshots --viewports 320,375,390,768,1024,1280,1440,1920 --no-shots`)
- [x] Teclado, skip link, focus-visible, dialog com focus trap (Auto — e2e/axe)
- [x] Acessibilidade axe sem violações sérias/críticas (Auto)
- [ ] Safari / iOS Safari revisados manualmente (Manual — PRD §91)
- [x] Links internos, 404 própria, error boundaries (Auto)
- [x] Headers de segurança; CSP em Report-Only (Auto) → [ ] avaliar `CSP_ENFORCE=true` após validar tags no browser (Manual)
- [x] Nenhum secret no repositório (Auto — apenas `.env.example`)

## Pós-lançamento (Fase 9)

- [ ] Monitorar erros (logs do host / error monitoring se configurado), leads recebidos, eventos no GA4, 404 no Search Console, Core Web Vitals p75 (CrUX) por 30 dias
