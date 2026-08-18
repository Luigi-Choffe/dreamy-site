# TRACKING — Contrato do dataLayer e configuração de tags (PRD §43–§45, §72–§73, §94)

## Arquitetura

- **GTM é a única camada de tags.** O código nunca carrega GA4, Meta Pixel ou LinkedIn diretamente. IDs de GA4/Meta/LinkedIn são configurados **dentro do container**.
- Carregamento: `src/components/analytics/GoogleTagManager.tsx` injeta (1) script inline no `<head>` que cria `window.dataLayer`, define `gtag()`, aplica **Consent Mode v2 default = denied** (ou o estado salvo no cookie `dreamy_consent`) e (2) o snippet do GTM com `strategy="afterInteractive"` — somente quando `NEXT_PUBLIC_GTM_ID` está definido. Sem ID, os eventos continuam sendo empilhados no `dataLayer` (útil para QA local).
- Helpers tipados: `src/lib/analytics/events.ts` (`track()`), `src/lib/analytics/attribution.ts` (UTMs), `src/lib/consent/*` (consentimento).
- **PII nunca entra no dataLayer**: nome, e-mail, telefone, empresa, cargo e texto do problema ficam restritos ao fluxo `POST /api/leads`. Há teste unitário que garante que `track()` rejeita chaves proibidas.

## Consent Mode v2

| Categoria do banner | Sinais atualizados                                                |
| ------------------- | ----------------------------------------------------------------- |
| necessário          | sempre `granted` para `functionality_storage`, `security_storage` |
| analytics           | `analytics_storage`                                               |
| marketing           | `ad_storage`, `ad_user_data`, `ad_personalization`                |

Fluxo: `gtag('consent','default', {all: 'denied', wait_for_update: 500})` no head → usuário escolhe no banner (aceitar tudo / rejeitar / gerenciar) → `gtag('consent','update', …)` + `dataLayer.push({event:'consent_update', consent_analytics, consent_marketing})`. Preferências reabríveis pelo link "Preferências de cookies" (footer e página /cookies). Cookie `dreamy_consent` (first-party, 180 dias, `SameSite=Lax`).

No GTM: tags de GA4 exigem `analytics_storage`; Meta e LinkedIn exigem `ad_storage`/`ad_user_data` (Consent Settings → "Require additional consent").

## Eventos (dataLayer)

Todos os pushes têm a forma `{ event: '<nome>', ...params }`. Parâmetros não listados são proibidos.

| Evento               | Quando                                                                                              | Parâmetros                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page_view`          | carga inicial e toda navegação SPA (`RouteChangeTracker`)                                           | `page` (pathname), `page_title`                                                                                                                         |
| `cta_click`          | clique em qualquer CTA principal                                                                    | `cta_id`, `cta_location`, `page`, `intent`                                                                                                              |
| `solution_view`      | visualização de página de solução (`/solucoes/*`)                                                   | `solution` (`nova-receita-digital` \| `sistemas-sob-medida` \| `agentes-de-ia`)                                                                         |
| `case_view`          | visualização de `/cases/[slug]`                                                                     | `case_slug`                                                                                                                                             |
| `form_start`         | primeira interação com o formulário de contato                                                      | `page`                                                                                                                                                  |
| `form_step_complete` | conclusão de uma etapa válida                                                                       | `step` (1 \| 2)                                                                                                                                         |
| `form_error`         | erro de validação/servidor/rede                                                                     | `field` (nome do campo ou `_form`), `error_type` (`validation` \| `server` \| `network` \| `rate_limit`) — **nunca o valor preenchido**                 |
| `generate_lead`      | resposta de sucesso do `POST /api/leads` — evento principal de conversão                            | `solution` (necessidade escolhida), `lead_bucket` (`alta` \| `media` \| `avaliacao`), `urgency_bucket` (`ate_30d` \| `1_3m` \| `3_6m` \| `pesquisando`) |
| `schedule_start`     | clique no link de agendamento após o envio                                                          | `page`                                                                                                                                                  |
| `meeting_scheduled`  | quando a ferramenta de agendamento notificar (postMessage/redirect) — só se tecnicamente mensurável | `page`                                                                                                                                                  |
| `consent_update`     | após escolha de consentimento                                                                       | `consent_analytics`, `consent_marketing` (booleans)                                                                                                     |

`intent` em `cta_click`: `contact` \| `solutions` \| `solution:<slug>` \| `case` \| `insight` \| `whatsapp` \| `booking` \| `about` \| `how_we_work` \| `home`.

## Configuração esperada no container GTM

1. **Variáveis do dataLayer**: `page`, `cta_id`, `cta_location`, `intent`, `solution`, `case_slug`, `step`, `field`, `error_type`, `lead_bucket`, `urgency_bucket`.
2. **GA4 Configuration (Google Tag)**: `send_page_view = false`; acionador Initialization; Consent: requer `analytics_storage`.
3. **GA4 Event – page_view**: acionador Custom Event `page_view`; parâmetros `page_location` = URL atual. (Não usar o gatilho "All Pages/History Change" para page_view — evita duplicidade.)
4. **GA4 Events**: um tag por evento acima (ou um tag genérico "GA4 – dataLayer event" com nome `{{Event}}` e os parâmetros mapeados). Marcar `generate_lead` como conversão/evento-chave.
5. **Meta Pixel**: base code no acionador Initialization com consent (`ad_storage`); `Lead` no evento `generate_lead`.
6. **LinkedIn Insight Tag**: acionador Initialization com consent (`ad_storage`); conversão em `generate_lead`.
7. **Preview**: validar cada evento individualmente (PRD §94) e a ausência de PII em qualquer parâmetro.
8. GA4 existente no site Framer: `G-5K32R2LMG3` — se reutilizado, remover a instalação direta ao migrar (nunca GA4 duplicado).

## Atribuição (UTMs)

`src/lib/analytics/attribution.ts` captura `utm_source|medium|campaign|content|term`, `referrer` e `landing_page` na primeira página vista, guarda em `sessionStorage` (sessão) e, se houver consentimento de analytics, em cookie first-party `dreamy_attr` (30 dias, first-touch). No envio do formulário os valores são anexados ao lead (server-side). Sem fingerprinting.

## QA (PRD §94)

Checklist em `docs/QA.md` → seção Analytics. Modo de verificação local sem GTM: `window.dataLayer` no console do browser (o app empilha eventos mesmo sem container).
