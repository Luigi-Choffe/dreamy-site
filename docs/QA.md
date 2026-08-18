# QA — Checklists e registro de verificação (PRD §90–§95, §106–§108)

Screenshots de cada fase em `docs/qa/<fase>/` (390 px, 768 px, 1440 px), gerados com `pnpm qa:screenshots` (Playwright contra o servidor local).

## Definition of Done por fase (PRD §106)

Código: build ok · lint ok · typecheck ok · testes relevantes ok · console sem erro crítico.
Visual: desktop revisado · mobile revisado · screenshots gerados.
UX: navegação funciona · estados existem · teclado funciona.
Conteúdo: sem placeholder · sem lorem ipsum · sem métricas inventadas.
Técnico: SEO válido · analytics aplicável validado · performance revisada.

## Responsividade (PRD §64)

Validar 320, 375, 390, 768, 1024, 1280, 1440, 1920 px. Sem overflow horizontal. Nenhuma interação essencial depende de hover. CTAs principais visíveis em mobile.

## Formulário (PRD §92)

- [ ] e-mail válido / inválido
- [ ] telefone (formatos BR com/sem DDI, com máscara e sem)
- [ ] campos vazios (mensagens acessíveis, foco no primeiro erro)
- [ ] texto longo (limites e contagem)
- [ ] spam (honeypot preenchido → 200 silencioso sem processar; envio < 3 s → rejeitado)
- [ ] double-click (botão desabilitado; `submissionId` idempotente)
- [ ] refresh durante envio (novo `submissionId`; sem duplicidade no CRM em janela de 10 min)
- [ ] timeout / integração indisponível (mensagem de erro, campos preservados, retry)
- [ ] conexão lenta (estado submitting visível)
- [ ] mobile keyboard (`inputmode`, `autocomplete`, `enterkeyhint`)

## SEO (PRD §93)

- [ ] um H1 por página · title · description · canonical · sitemap · robots · OG · favicon · structured data · 404 · redirects · noindex em preview

## Analytics (PRD §94)

- [ ] page_view (inicial + navegação SPA, sem duplicidade)
- [ ] cta_click · solution_view · case_view
- [ ] form_start · form_step_complete · form_error
- [ ] generate_lead (solution, lead_bucket, urgency_bucket)
- [ ] schedule_start / meeting_scheduled (se aplicável)
- [ ] ausência de PII em todos os eventos
- [ ] consentimento: nada de analytics/marketing antes do aceite; update correto após escolha

## Performance (PRD §95)

- [ ] Lighthouse mobile ≥ 90 / 95 / 95 / 95 (registrar números por página)
- [ ] LCP do Hero (imagem/texto não lazy), fontes (swap, subset), imagens (dimensões, AVIF/WebP), third-party (só via GTM), hydration (bundle das rotas)

## Acessibilidade (PRD §65)

- [ ] axe sem violações críticas/sérias em todas as rotas
- [ ] navegação por teclado (header, dropdown, menu mobile, accordion, dialog, formulário)
- [ ] skip link · focus-visible · labels · mensagens de erro anunciadas · contraste · reduced motion

## Segurança

- [ ] headers (CSP report-only → enforce, nosniff, referrer, permissions, HSTS)
- [ ] payload > 16 KB rejeitado · rate limit · sem stack trace na resposta · sem secrets no repo

## Browsers (PRD §91)

Chrome · Edge · Firefox · Safari · iOS Safari · Android Chrome (versões modernas)

## Registro de execuções

| Data | Fase | Build | Lint | Types | Unit | E2E | Screenshots | Observações |
| ---- | ---- | ----- | ---- | ----- | ---- | --- | ----------- | ----------- |
