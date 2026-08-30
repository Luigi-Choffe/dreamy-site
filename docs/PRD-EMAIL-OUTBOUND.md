# PRD v1.0 — Dreamy Outbound (campanhas de e-mail por indústria + dashboard interno)

Empresa: Dreamy
Produto: sistema interno de campanhas de e-mail B2B segmentadas por indústria, enviadas via Resend e operadas pelo agente (Claude), com dashboard interno de métricas.
Versão: 1.0
Status: EM OPERAÇÃO desde 2026-08-29 — campanha `construcao-nova-receita` aprovada (Luigi Choffe) e automação ARMADA; tarefa agendada "DreamyOutboundAuto" (dias úteis 09:05); 1º disparo real: segunda 2026-08-31 (16 incorporadoras, rampa 15/dia) · **PIVÔ 2026-08-29 (§29)**: este repositório passa a ser a plataforma de vendas hospedada da Dreamy (console na Vercel + Postgres Neon + login do time por link mágico); o site institucional fica com o sócio, em outro deploy · **CRM PILOTO desde 2026-08-30 (ADR-025)**: pipeline de negócios, conta do contato com timeline, tarefas/hoje, fila de demandas do MORK, IA env-gated (briefing + triagem, gate humano) e funil de valor implementados por cima do console; motor de envio intocado
Idioma: pt-BR
Origem da lista: export do Clay (Excel), entregue pelo usuário (pendente)
Documentos relacionados: `docs/PRD.md` (site — fonte de verdade de posicionamento e copy), `docs/apresentacao/` (pitch), `docs/CONTENT-SOURCES.md` (claims permitidos), `.agents/rules/dreamy-site.md`

## 0. REGRA FUNDAMENTAL DESTE DOCUMENTO

- Este PRD governa apenas o subsistema de outbound. Em conflito de posicionamento, oferta ou copy, `docs/PRD.md` prevalece (mesma ordem de prioridade: posicionamento → regras de negócio → arquitetura → UX → copy → design → implementação).
- Herda integralmente o PRD §2 do site: **nunca inventar métricas, clientes, cases, percentuais ou depoimentos**. Todo dado comercial em e-mail precisa de fonte aprovada em `docs/CONTENT-SOURCES.md` ou ser dado público de terceiro com atribuição no próprio e-mail. Simulações sempre rotuladas como simulação/exemplo.
- Nenhum envio real acontece sem confirmação explícita do usuário na sessão (ver §20).

## 1. CONTEXTO E OBJETIVO

- A Dreamy tem site V1 pronto (`www.dreamy.app.br`, deploy pendente) e apresentação comercial completa (14 slides + roteiro). Não tem canal ativo de prospecção outbound.
- O usuário recebeu do Clay uma lista de contatos B2B (Excel) e quer: (a) campanhas de e-mail, **uma por indústria**; (b) disparos executados diretamente pelo agente (Claude) via Resend; (c) dashboard interno para acompanhar entrega, abertura, cliques, respostas e descadastros.
- Objetivo de negócio (herda PRD §112 do site): **gerar reuniões qualificadas** — o e-mail vende a conversa/diagnóstico, nunca o projeto.
- Métrica norte do subsistema: **respostas positivas → reuniões agendadas** por campanha. Abertura e clique são métricas de apoio (ver §21 — abertura é estruturalmente inflada).

## 2. DECISÃO CRÍTICA — RESEND × COLD OUTREACH (LER ANTES DE TUDO)

**Fato**: a Acceptable Use Policy do Resend (resend.com/legal/acceptable-use) proíbe expressamente o caso de uso planejado:

> "You are prohibited from sending unsolicited messages of any kind, including **cold outreach, purchased lists, or scraped contact data**." (…) "All mail must be sent to recipients who have explicitly opted in."

Enforcement declarado: complaint rate < 0,08% e bounce rate < 4%; acima disso "your account may be shutdown without warning", sem reembolso. Uma lista do Clay é, por definição, lista sem opt-in.

**Consequência**: enviar cold e-mail pela conta Resend arrisca o encerramento da conta inteira — incluindo o e-mail transacional do site (notificação de leads, `EMAIL_PROVIDER=resend` já previsto no `.env.example`).

**Opções** (decisão do usuário, registrada depois como ADR):

- **Opção A — Resend assim mesmo (escolha atual do usuário, risco aceito).** Mitigações obrigatórias: conta Resend **separada** da conta transacional do site; **domínio de envio separado** do domínio principal (§17); lista 100% verificada antes do envio (bounce esperado < 2%); volume baixo com rampa (§17); micro-segmentos relevantes (complaint esperado < 0,1%); one-click unsubscribe desde o primeiro e-mail; circuit breaker automático (§21). O risco residual não é eliminável: a conta pode ser encerrada a qualquer momento por violação de AUP.
- **Opção B — híbrido (recomendada).** Ferramenta dedicada de cold outreach (Smartlead/Instantly/Lemlist: caixas Google Workspace, warm-up automático, envio "human-like") para o primeiro contato frio; Resend entra para quem responde/aceita receber material (nurture opt-in, dentro da AUP) e para o transacional. O dashboard deste PRD consome as duas fontes.
- **Opção C — Resend só com base opt-in.** Adiar o cold; usar Resend apenas para contatos com relacionamento/opt-in documentado. Não atende o objetivo imediato.

**Decisão de engenharia independente da opção**: a camada de envio é um **adapter** (`OutboundProvider`), no padrão já usado em `src/lib/email/index.ts` — trocar Resend por outra ferramenta depois não pode custar reescrita. Tudo o mais neste PRD (modelo de dados, importação, supressão, dashboard, compliance) vale para qualquer opção.

Gate: **nenhum envio real (Fase 3+) antes de o usuário escolher A, B ou C por escrito.** As Fases 0–2 (fundação, importação, dashboard sem envio) não dependem desta decisão.

## 3. REGRAS INEGOCIÁVEIS

Herdadas do site (`.agents/rules/dreamy-site.md`, PRD §2):

- Sem métricas, clientes, cases, depoimentos ou resultados inventados. Estado atual: **nenhum claim próprio aprovado** — a prova nos e-mails vem de (a) dados públicos de terceiros com fonte citada (os três do slide "Por que agora", §6) e (b) simulações rotuladas.
- Exatamente três ofertas: **Nova Receita Digital**, **Sistemas Sob Medida**, **Agentes de IA**. Campanha por indústria escolhe uma **oferta âncora** entre as três — nunca cria uma quarta.
- Sem NoCode/LowCode/Bubble; sem vender chatbot, MVP, landing page, branding, e-commerce, treinamento ou consultoria gratuita.
- Faixa de faturamento do ICP (R$ 15–150 mi) é critério **interno** de segmentação — nunca aparece em e-mail.
- Secrets só em env; apenas nomes em `.env.example`.

Novas, específicas do outbound:

- **E-mail de destinatário é PII**: nunca em logs (usar `contact_id`/hash), nunca em analytics/GA4, nunca em URLs de tracking próprias.
- **Supressão é sagrada**: opt-out, hard bounce e complaint entram na lista de supressão global no mesmo dia e nunca mais recebem e-mail, em nenhuma campanha. Verificação de supressão acontece imediatamente antes de todo envio.
- **Nenhum envio sem**: lista verificada (§11), unsubscribe one-click funcional (§15), domínio autenticado SPF+DKIM+DMARC (§17), copy aprovada pelo usuário (§20) e confirmação explícita do usuário na sessão.
- **Identificação do remetente** em todo e-mail: razão social/CNPJ e forma de contato (LGPD, §18). Pendência: CNPJ/razão social hoje estão `null` em `src/config/site.ts` — bloqueia o primeiro envio (§24).
- Todo e-mail da sequência para automaticamente quando o contato responde, descadastra, faz bounce ou reclama.
- Respeitar cadência máxima: 4 toques por sequência, reabordagem do mesmo contato só após 6 meses e com ângulo novo.

## 4. ESCOPO E NON-GOALS

Escopo V1:

1. Importação do Excel do Clay com validação, deduplicação, registro de origem (LGPD) e preparação para verificação externa.
2. Modelo de campanhas: uma campanha por indústria, cada uma com oferta âncora, sequência de até 4 e-mails e variáveis de personalização.
3. Motor de envio via Resend (batch API, tags, idempotência, rampa de volume, janelas de envio, supressão).
4. Webhooks Resend (entrega, bounce, complaint, abertura, clique) com verificação de assinatura e armazenamento de eventos.
5. Página pública de descadastro + endpoint one-click (RFC 8058) + supressão global.
6. Dashboard interno protegido: funil por campanha e por indústria, guard-rails, lista de respostas.
7. Registro de respostas (manual na V1; inbound automático é V1.1 — §14).
8. Operação por CLI (`pnpm outbound:*`) executada pelo agente com dry-run e gates de aprovação.

Non-goals V1:

- CRM completo, automação de vendas, lead scoring de outbound (o scoring existente do site permanece intocado).
- Editor visual de e-mails, templates React Email elaborados — cold e-mail é texto simples (§6).
- Warm-up automatizado de caixas (não existe em API transacional; ver Opção B).
- A/B testing estatístico formal (V1 mede por variante, mas sem motor de significância).
- Multi-tenant, multi-usuário com papéis — auth simples de time (§16).
- Integração automática com o formulário do site / CRM (correlação por UTM é manual na V1; hook opcional em V2).

## 5. PÚBLICO, LISTA E SEGMENTAÇÃO POR INDÚSTRIA

- ICP (herdado do PRD §8–§9 do site): empresas estabelecidas, 30–300 colaboradores, operação validada, algum nível de digitalização (CRM/ERP/planilhas/WhatsApp), **sem grande estrutura interna de software**. Cargos-alvo em ordem: Founder, Sócio, CEO, Diretor-geral, COO, Diretor Comercial, Diretor de Operações, Diretor de Tecnologia/Inovação. Falar com quem sente impacto econômico.
- **Uma campanha por indústria** (pedido do usuário). Micro-segmento ideal: indústria × cargo × dor — pesquisa de mercado indica queda relevante de resposta acima de ~100 contatos por segmento e ~2% de reply em campanhas genéricas de 500+; personalização por dor de indústria rende 9–15% vs 5–9% da personalização básica `{nome}/{empresa}`.
- Colunas mínimas esperadas do Excel do Clay (validar na importação; nomes reais mapeados em config): nome, sobrenome, e-mail corporativo, cargo, empresa, indústria/setor, site/domínio, porte (funcionários), LinkedIn (opcional), campos de enriquecimento (opcional), **fonte do dado por campo** (se o Clay exportar — registrar; senão, registrar a procedência do run do Clay no lote de importação).
- Contatos fora do ICP (cargo irrelevante, e-mail pessoal @gmail etc., porte fora da faixa) são marcados `excluded` com motivo — nunca descartados silenciosamente (auditoria).

Framework de campanha por indústria (preencher quando a lista chegar — **exemplos ilustrativos**, validar contra a lista real):

| Indústria (exemplo)      | Oferta âncora               | Dor traduzida (cena do slide 03 no vocabulário do setor)                            | Gancho de abertura                                          |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Distribuição / atacado   | Sistemas Sob Medida         | Pedidos em planilha, ERP que não conversa com o comercial, ruptura descoberta tarde | "O ERP diz uma coisa, o vendedor vê outra"                  |
| Indústria / manufatura   | Agentes de IA (Operação)    | Relatórios de produção montados à mão, apontamentos em papel/planilha               | "Quanto tempo entre o fim do turno e o número na sua mesa?" |
| Serviços B2B recorrentes | Nova Receita Digital        | Base grande de clientes monetizada só pelo serviço principal                        | "O que MAIS seus clientes comprariam de você?"              |
| Saúde / clínicas em rede | Agentes de IA (Atendimento) | Agenda e confirmação manuais, leads sem retorno em horas                            | "Leads que esperam horas esfriam em minutos"                |

Regra do framework: a dor é sempre uma **cena reconhecível** do setor (traduzida das dores genéricas do site/apresentação) — nunca uma estatística inventada do setor, nunca um case fictício.

## 6. ESTRATÉGIA DE MENSAGEM (HERDADA DO SITE E DA APRESENTAÇÃO)

Fonte: copy real do site (`src/content/`) e da apresentação (`docs/apresentacao/`). O e-mail é a versão 1:1 do mesmo arco: problema → identificação → diagnóstico → conversa.

- **Tom**: executivo, direto, consultivo, honesto, sem jargão técnico, sem hype de IA. Frases curtas. Dor e impacto econômico, nunca stack.
- **Formato**: 50–120 palavras, texto simples (sem HTML pesado, sem imagens), 1 ideia por e-mail, 1 CTA de baixo atrito. Primeiro toque **sem link** (melhor entregabilidade); link só a partir do 2º/3º toque.
- **Posição central**: "Começamos pelo problema. A tecnologia vem depois." / "Nem todo problema da sua empresa cabe em um software pronto." / "A empresa cresceu mais rápido do que a tecnologia dela."
- **Remoção de objeção** (a arma principal na ausência de cases): "Você não precisa saber o que construir. Nossos clientes chegam com uma dor, não com uma especificação." + honestidade: "às vezes a resposta é: não vale a pena construir nada."
- **Ganchos por oferta** (JTBD do PRD §10 na voz do prospect):
  - Nova Receita Digital: "Existe dinheiro na minha base de clientes…" → "Se apenas uma parte dos seus clientes pagasse por um novo produto digital, o que valeria a pena construir?"
  - Sistemas Sob Medida: "Nenhum software existente resolve direito…" → "Software pronto foi feito para a média, não para o SEU processo."
  - Agentes de IA: "Quero IA que gere resultado de verdade…" → "Não é um chatbot. É software que executa etapas de um processo." / "Autonomia com controle. Sempre nessa ordem."
- **Prova permitida**:
  - Dados de mercado com fonte no corpo do e-mail (únicos números aprovados): 88% das empresas já usam IA em ao menos uma função, ante 78% um ano antes (McKinsey, State of AI 2025); US$ 252 bi investidos em IA em 2024, +44% (Stanford AI Index 2025); retorno médio de 3,7× por US$ 1 em IA generativa (IDC/Microsoft, 2024).
  - Simulação de receita **sempre rotulada** ("exemplo ilustrativo"): mecânica `clientes × ticket × 30% de adesão` com a frase de custo de inação — "Cada mês sem o produto no ar: R$ X que ficam na mesa." Usar apenas em campanhas com âncora Nova Receita Digital, com números redondos declarados como exemplo.
  - Proibido: qualquer número próprio da Dreamy, nomes de clientes, logos, depoimentos (nada está aprovado em `docs/CONTENT-SOURCES.md`).
- **Assinatura**: nome real do remetente + Dreamy + site + identificação legal (§18). Sem banner, sem logo pesado.

## 7. SEQUÊNCIA E CADÊNCIA

Sequência padrão por campanha (4 toques, ~17 dias — dentro do consenso 3–5 toques/14–21 dias):

| Passo | Dia | Ângulo                                                                                          | Link?                                         |
| ----- | --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| E1    | 0   | Cena de dor da indústria + pergunta curta (gancho da oferta âncora)                             | Não                                           |
| E2    | +3  | "Você não precisa saber o que construir" — diagnóstico, remoção de objeção                      | Não                                           |
| E3    | +7  | Prova: dado de mercado com fonte OU simulação rotulada (Nova Receita)                           | Sim — página da solução com `?solucao=` + UTM |
| E4    | +7  | Encerramento curto e educado ("encerro por aqui; se fizer sentido um dia, a porta está aberta") | Não                                           |

- Cada follow-up agrega ângulo novo — nunca "só passando para lembrar". Sem breakup passivo-agressivo.
- Parada imediata e automática do restante da sequência em: resposta (qualquer), unsubscribe, bounce, complaint.
- Envios apenas em dias úteis, janela comercial (config: `09:00–17:30 America/Sao_Paulo`), volume espaçado dentro da janela.
- Reabordagem do mesmo contato: nunca antes de 6 meses, sempre com campanha/ângulo novos.

## 8. CTAS, LINKS E ATRIBUIÇÃO

- **CTA primário: a resposta ao e-mail** ("faz sentido conversar?" / "Qual problema da sua empresa valeria a pena resolver agora?"). Reunião é agendada na conversa — não mandar link de agenda no frio (`NEXT_PUBLIC_BOOKING_URL` nem existe ainda).
- CTA secundário (E3): página da solução âncora com pré-seleção do formulário — `https://www.dreamy.app.br/solucoes/<slug>` e `/contato?solucao=nova-receita|sistema|agente-ia`.
- WhatsApp `wa.me/5511948793233` pode aparecer na assinatura **após** confirmação do número (ADR-013 — pendência §24).
- Convenção UTM (o site já captura e preserva UTMs e alimenta o lead scoring): `utm_source=outbound` · `utm_medium=email` · `utm_campaign=<slug-da-industria>` · `utm_content=e3` (passo). Correlação outbound → lead do site é feita no CRM/notificação de lead pela presença de `utm_source=outbound` (manual na V1).
- Links só passam pelo tracking de clique do Resend (subdomínio de tracking próprio, §17) — sem encurtadores de terceiros.
- Condição de deploy: os links do site só entram em e-mail quando o site estiver em produção com `NEXT_PUBLIC_SITE_ENV=production` (hoje qualquer deploy sai noindex — ADR-017). Até lá, E3 degrada para versão sem link.

## 9. ARQUITETURA DO SISTEMA

Princípios (herdados da casa): adapters trocáveis por env, fetch/REST antes de SDK, fail-safe explícito, Server Components por padrão, logs JSON sem PII, dependência nova só com ADR.

```
[Excel Clay] → pnpm outbound:import → ┐
                                      │ (validação Zod, dedupe, origem)
[Verificação de e-mails (externa)] → ┘
                                       ↓
                              [Postgres (Neon)]
                    contatos · campanhas · envios · eventos · supressão
                                       ↑↓
   CLI local (agente/Claude)           │           App Next.js (Vercel)
   outbound:plan / :send               │   /api/outbound/webhooks (Svix verify)
   (batch Resend, idempotente,         │   /descadastro (GET página, POST one-click)
    rampa, janela, supressão)          │   /interno/outbound (dashboard, auth)
                                       ↓
                                   [Resend API]
                          envio batch · eventos via webhook
```

- **CLI local** (`scripts/outbound/*.ts`, rodado com tsx pelo agente): importação, planejamento, montagem de lotes, disparo, relatórios. É onde vive a operação — nada de envio disparado por cron da Vercel na V1.
- **App Next.js** (o mesmo repo/projeto do site): apenas as superfícies que precisam ser públicas ou visuais — webhook, descadastro, dashboard. Route Handlers no padrão do `/api/leads` (runtime nodejs, limites de payload, Zod, requestId, códigos tipados).
- **Postgres gerenciado** (Neon via Vercel Marketplace — decisão §19): única fonte de verdade de contatos, envios, eventos e supressão. Acessível tanto do CLI local quanto das rotas na Vercel.
- **Resend**: envio (batch API com tags e idempotency key) + eventos (webhooks assinados). Conta e domínio separados do transacional do site (§2, §17).

## 10. MODELO DE DADOS

Tabelas (nomes finais na implementação; chaves estrangeiras implícitas):

- `import_batches` — id, arquivo, data, origem declarada (ex.: "Clay run X, fontes: Apollo+site"), contagens (linhas, válidas, excluídas, duplicadas). Base da resposta LGPD "de onde veio meu dado".
- `contacts` — id, e-mail (único, citext), nome, sobrenome, cargo, empresa, domínio da empresa, indústria (normalizada), porte, linkedin_url, campos extras (jsonb), import_batch_id, verification_status (`ok | risky | invalid | unverified`), status (`active | excluded | suppressed`), excluded_reason, created_at.
- `campaigns` — id, slug (ex.: `distribuicao-2026-09`), indústria, oferta âncora (`nova-receita | sistema | agente-ia`), status (`draft | approved | running | paused | done`), copy aprovada em (timestamp + por quem), config (janela, cap diário, remetente).
- `campaign_steps` — id, campaign_id, ordem (1–4), offset em dias, subject, corpo (texto com variáveis `{{nome}}`, `{{empresa}}`…), variante (para teste A/B simples), com_link (bool).
- `enrollments` — contato × campanha: id, contact_id, campaign_id, status (`pending | active | replied | finished | stopped`), stop_reason (`reply | unsubscribe | bounce | complaint | manual`), próximo passo previsto.
- `sends` — um por e-mail disparado: id, enrollment_id, step_id, resend_email_id, idempotency_key, scheduled_at, sent_at, status (`scheduled | sent | delivered | bounced | failed | canceled`).
- `events` — um por evento de webhook: id, send_id (via tags), tipo (`sent | delivered | delivery_delayed | bounced | complained | opened | clicked | failed | suppressed`), payload resumido (sem PII redundante), svix_id (único — dedupe), occurred_at.
- `suppressions` — e-mail (único), motivo (`unsubscribe | hard_bounce | complaint | manual | client`), origem (campanha/canal), created_at. **Nunca expira.**
- `replies` — id, contact_id, campaign_id, data, classificação (`interested | not_now | referral | negative | ooo | other`), notas, registrada_por (`manual | inbound`). V1: manual via CLI/dashboard.
- `unsubscribe_tokens` — token opaco por enrollment (não adivinhável, sem PII na URL), usado nas URLs de descadastro.

Regras:

- Tags Resend em todo envio: `campaign_id`, `contact_id`, `step` — é o mecanismo de correlação nos webhooks (voltam no payload).
- `events` é append-only; agregados do dashboard são queries sobre ele (materializar depois se precisar).
- Retenção (LGPD, minimização): contatos que terminaram sequência sem resposta são anonimizáveis após 12 meses (config); `suppressions` mantém apenas o e-mail (necessário para honrar opt-out) — documentar como obrigação legal.

## 11. IMPORTAÇÃO E HIGIENE DA LISTA

Pipeline `pnpm outbound:import --file <xlsx|csv> --batch "<descrição da origem>"`:

1. Parse do Excel/CSV (dependência nova a decidir — §19; alternativa zero-dependência: usuário exporta CSV do Clay).
2. Mapeamento de colunas por config (`scripts/outbound/import-map.ts`) — o Clay muda cabeçalhos entre runs; o mapa é revisado a cada lista nova.
3. Validação Zod por linha: e-mail sintaticamente válido e corporativo (rejeitar domínios pessoais — lista configurável), cargo presente, indústria presente. Linhas inválidas → relatório, nunca importadas silenciosamente.
4. Normalização: e-mail lowercase, indústria mapeada para taxonomia interna (config por campanha), telefone/URLs limpos.
5. Deduplicação: por e-mail (global) e por empresa×cargo (aviso). Contato já existente não é duplicado — ganha vínculo com o novo lote.
6. Filtro de ICP: cargo fora da lista-alvo, porte fora da faixa → `excluded` com motivo.
7. **Checagem de supressão**: e-mail presente em `suppressions` nunca reentra como `active`.
8. Saída: relatório do lote (contagens, amostra, distribução por indústria/cargo) para o usuário aprovar antes de qualquer passo seguinte.

Verificação de entregabilidade (obrigatória antes do 1º envio de cada lote — lista fria com bounce > 3% queima o domínio em dias):

- Export dos e-mails `unverified` → verificação externa (MillionVerifier / ZeroBounce / NeverBounce — decisão §24; o waterfall do próprio Clay conta como primeira camada, não como final) → import do resultado (`outbound:verify --file <csv>`).
- Política: `invalid` → excluded; `catch_all`/`unknown` (risky) → **não entram** na campanha da V1 (segregar para decisão futura); só `ok` recebe e-mail.
- Lista com mais de 60 dias desde a verificação → re-verificar antes de usar.

## 12. MOTOR DE ENVIO

- `pnpm outbound:plan --campaign <slug>`: gera o plano do dia — quem recebe qual passo, respeitando: supressão (checada na hora), status do enrollment, rampa (§17), cap diário, janela de envio, dias úteis. Saída legível para aprovação.
- `pnpm outbound:send --campaign <slug> [--dry-run]`: executa o plano. `--dry-run` é o default implícito na operação do agente (§20) — envio real exige flag explícita `--confirm` + confirmação do usuário na sessão.
- Mecânica Resend:
  - `POST /emails/batch` com até 100 e-mails por chamada (rate limit 10 req/s do time — irrelevante nos volumes deste PRD), 1 destinatário por e-mail (nunca múltiplos `to`).
  - `Idempotency-Key: <campaign>/<contact>/<step>` (janela de 24 h no Resend) + unicidade local em `sends.idempotency_key` — retry nunca duplica e-mail.
  - Tags: `campaign_id`, `contact_id`, `step`. Headers: `List-Unsubscribe` (URL HTTPS com token) + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` em **todo** envio.
  - `reply_to`: caixa monitorada da equipe comercial (config).
  - `scheduled_at` para espaçar envios dentro da janela do dia (goteo, não rajada). Cancelamento de agendados via API se o circuit breaker (§21) disparar.
  - Sem attachments (não suportado no batch; e cold e-mail não anexa nada).
- Falha de chamada: retry com backoff (3×, padrão do adapter de CRM existente); falha persistente → send `failed`, relatório ao usuário. Nunca re-enfileirar silenciosamente no dia seguinte sem registro.
- Implementação server-side pura; a API key do Resend nunca chega ao browser (CSP `connect-src` intocada).

## 13. WEBHOOKS E EVENTOS

- Rota `POST /api/outbound/webhooks` (Route Handler, runtime nodejs, `dynamic force-dynamic`), no padrão do `/api/leads`: limite de payload, requestId, códigos tipados, `cache-control: no-store`.
- **Verificação de assinatura Svix obrigatória** (`svix-id`, `svix-timestamp`, `svix-signature`) com o signing secret em env. Sem assinatura válida → 401, sem processamento. Autenticidade nunca depende de obscuridade da URL.
- Idempotência: `svix-id` único em `events` (Resend entrega at-least-once com retries 5s→10h) — duplicata → 200 sem efeito.
- Eventos assinados: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.suppressed`.
- Efeitos colaterais síncronos e mínimos (responder rápido; trabalho extra via `after()` do Next se necessário):
  - `bounced` (Permanent) → `suppressions` + parar enrollment + send `bounced`.
  - `complained` → `suppressions` + parar enrollment + alerta no dashboard.
  - `delivered | opened | clicked` → registrar evento (clique guarda o link, sem query string de PII).
- Pré-requisito de infra: projeto Vercel importado (pendência externa do site). Enquanto não houver URL pública: desenvolvimento com payloads gravados (fixtures) + túnel local para teste manual. Se Deployment Protection for ativada na Vercel, a rota de webhook precisa de bypass documentado.

## 14. RESPOSTAS (INBOUND)

- V1 (manual): respostas chegam na caixa `reply_to` monitorada pela equipe. Registro no sistema via CLI (`outbound:reply --email … --class interested`) ou pelo dashboard (form simples). A resposta para o enrollment automaticamente (o plano do dia seguinte já a detecta).
- V1.1 (automático — decisão futura): MX do subdomínio de envio já fica no Resend (exigência da verificação de domínio) → Resend Inbound entrega `email.received` no webhook → registro automático da resposta + encaminhamento para a caixa da equipe. Classificação continua humana.
- Classificações: `interested` (vira reunião — métrica norte), `not_now`, `referral`, `negative` (→ supressão manual se pedirem), `ooo` (não conta como resposta real), `other`.

## 15. DESCADASTRO E SUPRESSÃO

- Página pública `GET /descadastro?token=<t>`: confirma o descadastro em um clique, sem login, sem pedir e-mail (token → enrollment → contato). Copy sóbria, sem culpa, com confirmação visual. Segue o design system do site.
- Endpoint one-click `POST /descadastro` (RFC 8058): body do provedor → 200/202 com página em branco. É o alvo do header `List-Unsubscribe-Post`.
- Efeito imediato (< 48 h exigidos; na prática, instantâneo): `suppressions` + parar todos os enrollments do contato + cancelar sends agendados.
- Resposta com "remove/descadastra/não quero" no texto → tratada como opt-out manual no mesmo dia.
- A supressão é **global e permanente** (entre campanhas, listas e ferramentas — se a Opção B do §2 for adotada, exportar/sincronizar a supressão para a outra ferramenta).
- Direitos LGPD (art. 18): pedido de acesso/eliminação respondido com dados do contato + origem (import_batch); eliminação = anonimizar contato mantendo o e-mail apenas em `suppressions` (base legal: obrigação de honrar opt-out).

## 16. DASHBOARD INTERNO

- Rotas `/interno/outbound` (+ subrotas por campanha) no app do site. `noindex` sempre, fora do sitemap, sem links públicos.
- **Auth** (decisão §19/ADR): proposta V1 — senha única de time em env (`OUTBOUND_DASHBOARD_PASSWORD`), sessão via cookie assinado (HttpOnly, Secure, SameSite=Lax), guard em `proxy.ts` (novo nome do middleware no Next 16) cobrindo `/interno/*` e as APIs internas. Rate limit no login (reutilizar `src/lib/security/rate-limit.ts`). Alternativa sem código: Vercel Deployment Protection — rejeitada como mecanismo primário porque bloquearia o webhook e o descadastro público.
- Conteúdo (Server Components; dados via queries no Postgres):
  - **Visão geral**: cards por campanha — enviados, entregues, bounce %, complaint %, aberturas* , cliques, respostas, respostas positivas, reuniões, descadastros. Asterisco fixo em abertura: "inflada por proxies (Apple MPP/Gmail); use respostas e cliques para decidir" (§21).
  - **Funil por campanha**: enviado → entregue → clique → resposta → resposta positiva → reunião. Por passo (E1–E4) e por variante.
  - **Guard-rails em destaque**: bounce e complaint com faixas verde/âmbar/vermelho (limiares §21) + estado do circuit breaker.
  - **Timeline de eventos** e lista de respostas com classificação editável.
  - **Contatos**: busca por e-mail/empresa (uso interno; é PII — sem export público), estado do enrollment, histórico de envios/eventos.
  - **Supressão**: contagem por motivo, adição manual.
- Restrições técnicas herdadas: CSP sem `unsafe-eval` → gráficos em SVG/DOM puro (sem lib com eval); validação client (se houver) com `zod/mini` + jitless; nenhuma chamada client a domínio externo (dados sempre via rotas próprias). Charts seguem a skill de dataviz do workspace na implementação.
- O dashboard nunca dispara envios na V1 — operação é via CLI com gates (§20). Botões permitidos: pausar campanha, classificar resposta, suprimir contato (ações conservadoras).

## 17. DOMÍNIO, AUTENTICAÇÃO E ENTREGABILIDADE

- **Nunca enviar outbound do domínio principal** (`dreamy.app.br` fica para site + transacional). Decisão §24: domínio irmão (ex.: `dreamy.net.br`, com redirect para o site) ou subdomínio dedicado (ex.: `contato.dreamy.app.br`). Recomendação para cold: **domínio irmão** — isola totalmente a reputação; subdomínio ainda herda associação do domínio raiz.
- Setup no Resend (conta separada da transacional — §2): domínio verificado com DKIM (TXT) + SPF (TXT + MX no subdomínio de envio, região `sa-east-1` ou `us-east-1`); DMARC `p=none` com `rua=` → evoluir para `quarantine` após 4+ semanas limpas; tracking subdomain próprio (CNAME) com open/click tracking habilitado **apenas** no domínio de campanha (transacional continua sem tracking). Atenção: tracking subdomain não pode ser removido depois, só trocado.
- Google Postmaster Tools: cadastrar o domínio de envio no dia 0; spam rate é guard-rail (§21).
- **Rampa de volume** (domínio novo; caps aplicados pelo motor §12):

| Semana | Cap/dia (total do domínio)                                |
| ------ | --------------------------------------------------------- |
| 1      | 15                                                        |
| 2      | 30                                                        |
| 3      | 50                                                        |
| 4+     | 80 (teto da V1; escalar = mais domínios, não mais volume) |

- Regime: goteo dentro da janela comercial; nunca rajada. Plano Resend: Free (100/dia) cobre a rampa; Pro (US$ 20/mês) quando o volume mensal passar de 3 mil ou para folga operacional.
- Realismo (registrado para decisão do §2): envio via API/ESP não replica o padrão "caixa humana" das ferramentas de cold (Google Workspace + warm-up automático). Com Resend, a mitigação é volume baixo + relevância alta + lista impecável. É limite estrutural da Opção A.

## 18. LGPD E COMPLIANCE

- **Base legal**: legítimo interesse (art. 7º, IX) — contato comercial B2B, e-mail corporativo, oferta com conexão real à atividade do destinatário. Sem consentimento prévio exigido, mas com deveres:
  - **LIA/teste de balanceamento documentado** por campanha (arquivo `docs/outbound/lia-<campanha>.md`): finalidade, por que este segmento/cargo, por que a oferta é relevante, minimização aplicada.
  - **Minimização**: só nome, cargo, e-mail corporativo, empresa, indústria, porte. Sem CPF, sem telefone pessoal, sem dado sensível — o import descarta colunas fora do escopo.
  - **Origem demonstrável**: `import_batches` registra a procedência (run do Clay + fontes declaradas). Resposta padrão a "como conseguiram meu contato?" documentada.
  - **Identificação do remetente** em todo e-mail: razão social + CNPJ + cidade/UF + site + descadastro. **Bloqueio atual**: CNPJ/razão social `null` no projeto (§24).
  - **Opt-out fácil e honrado** (§15) + registro permanente.
  - Direitos do titular (art. 18): fluxo do §15.
- Risco honesto: prospecção B2B moderada, relevante, identificada e com opt-out funcional não é o alvo típico de enforcement da ANPD; o risco real está em volume indiscriminado, ignorar descadastro e dados sem procedência. As multas existem (até R$ 50 mi ou 2% do faturamento) — a disciplina acima é a defesa.
- Gmail/Yahoo bulk sender (padrão mínimo mesmo abaixo de 5 mil/dia): SPF+DKIM+DMARC alinhados, one-click unsubscribe RFC 8058, spam rate < 0,3% (meta < 0,1%).
- PII nunca em: logs (usar ids/hashes), GA4/dataLayer (regra existente do site), URLs.

## 19. STACK, DEPENDÊNCIAS E DECISÕES TÉCNICAS (ADRs A CRIAR)

Contexto herdado: Next.js 16.3.1 (App Router; **ler `node_modules/next/dist/docs/`** antes de implementar — route handlers, proxy.ts, authentication, after), React 19, TS 5.9, Tailwind 4, Zod 4 (`zod/mini` no client), pnpm, tsx para scripts, sem SDKs onde fetch basta (ADR-011).

ADRs a registrar em `docs/DECISIONS.md` na implementação (próximo livre: ADR-019):

1. **Banco de dados** (quebra o non-goal "sem banco" da V1 do site): proposta — Postgres gerenciado (Neon via Vercel Marketplace), acesso com driver serverless leve ou SQL via fetch, sem ORM pesado; migrações SQL versionadas em `scripts/outbound/migrations/`. Alternativas: Turso/SQLite (mais simples, menos padrão com Vercel), Upstash Redis (insuficiente para consultas analíticas — rejeitado).
2. **Parse de Excel**: dependência dev (`exceljs` ou similar) **ou** exigir export CSV do Clay (zero dependência — preferido se o fluxo do usuário permitir).
3. **Verificação de assinatura Svix**: lib `svix` oficial vs verificação HMAC manual (documentada pelo Svix). Proposta: lib oficial (criptografia não é lugar de artesanato) — exceção consciente ao padrão "sem SDK".
4. **Auth do dashboard**: senha de time + cookie assinado + guard em `proxy.ts` (reverte parcialmente ADR-010 "sem middleware" — registrar a tensão e o escopo mínimo do guard). Páginas do site permanecem estáticas.
5. **Envio via API própria vs Audiences/Broadcasts do Resend**: proposta — API própria (`/emails/batch`): segmentação e supressão são nossas, custo de Audiences por contato armazenado não se justifica, personalização por destinatário é total. Broadcasts reconsiderável para nurture opt-in (Opção B/C).
6. **Conta Resend separada** para outbound (isolamento do risco de AUP — §2) + domínio de envio (§17).

- Código: `src/lib/outbound/` (domínio: provider adapter, supressão, tokens), `src/app/api/outbound/`, `src/app/(site)/descadastro/`, `src/app/interno/outbound/`, `scripts/outbound/` (CLI). Testes: unit (vitest) para import/validação/supressão/webhook-dedupe; e2e (playwright) para descadastro e auth do dashboard; fixtures de payloads Svix.
- `pnpm check` continua sendo o gate. Novos comandos: `outbound:import`, `outbound:verify`, `outbound:plan`, `outbound:send`, `outbound:reply`, `outbound:report`.

## 20. OPERAÇÃO VIA AGENTE (CLAUDE)

O usuário pediu que os disparos sejam executados pelo agente. Protocolo:

1. **Copy**: o agente redige as sequências por indústria (seguindo §6) em arquivos versionados (`src/content/outbound/<campanha>/`). Campanha só vira `approved` depois de o usuário aprovar a copy explicitamente (aprovação registrada em `campaigns.copy_aprovada_em`).
2. **Plano antes de envio**: todo dia de disparo começa com `outbound:plan` — o agente apresenta ao usuário: quantos e-mails, quais passos, qual campanha, caps e estado dos guard-rails.
3. **Confirmação explícita por disparo**: `outbound:send --confirm` só roda depois de o usuário aprovar o plano na sessão. **O agente nunca dispara e-mail real por iniciativa própria** — nem em loop, nem em cron. Sem confirmação = dry-run.
4. **Relatório após disparo**: enviados, falhas, estado dos guard-rails; anomalia (bounce/complaint acima da faixa) = parar e reportar.
5. Ações sem gate (seguras): importar, verificar, planejar, relatar, classificar respostas quando o usuário informar, pausar campanha.
6. Auditoria: toda execução de CLI loga (JSON, sem PII) comando, operador, contagens e resultado.

## 21. MÉTRICAS, METAS E GUARD-RAILS

Hierarquia de métricas (honesta — decisão nunca por abertura):

1. **Respostas positivas e reuniões** (métrica norte). Meta realista de cold B2B bem feito: reply rate 5–10% (média de mercado 3–6%; genérico ≈ 2%).
2. **Cliques** (E3+): confiáveis o suficiente (proxies não clicam de forma significativa; scanners corporativos são ruído conhecido).
3. **Abertura**: registrada e exibida **sempre com a ressalva** — Apple MPP pré-carrega pixels (metade dos "opens" pode ser falsa), Gmail/Yahoo usam proxy de imagem. Serve para tendência grosseira entre variantes, nunca para meta.
4. **Guard-rails (param a máquina)**:

| Métrica                         | Verde   | Âmbar (alerta) | Vermelho (circuit breaker)                               |
| ------------------------------- | ------- | -------------- | -------------------------------------------------------- |
| Bounce (por campanha e por dia) | < 2%    | 2–3%           | > 3% → pausa automática da campanha + cancelar agendados |
| Complaint                       | < 0,05% | 0,05–0,1%      | > 0,1% → pausa de TODAS as campanhas                     |
| Spam rate (Postmaster)          | < 0,1%  | 0,1–0,3%       | ≥ 0,3% → pausa total + investigação                      |

- Circuit breaker: verificado pelo motor antes de cada lote e ao processar webhooks; estado exibido no dashboard; religar exige ação humana.
- Além dos limiares acima, lembrar os do próprio Resend (AUP): bounce ≥ 4% ou complaint ≥ 0,08% podem encerrar a conta — os guard-rails internos são deliberadamente mais rígidos.

## 22. FASES DE DESENVOLVIMENTO

FASE 0 — DECISÕES E INFRA EXTERNA

- Usuário decide: §2 (A/B/C), domínio de envio, ferramenta de verificação, CNPJ/razão social para assinatura, confirmação do WhatsApp.
- Comprar/configurar domínio de envio; criar conta Resend do outbound; DNS (DKIM/SPF/MX/DMARC/tracking CNAME); Postmaster Tools; importar projeto na Vercel (pendência já existente do site).
- Gate: decisões registradas (ADRs) + domínio verificado no Resend + deploy com URL pública.

FASE 1 — FUNDAÇÃO DE DADOS

- Postgres provisionado + migrações; `outbound:import` + `outbound:verify` completos com relatório; supressão global.
- Gate: lista real do Clay importada, validada, verificada; relatório aprovado pelo usuário; `pnpm check` verde.

FASE 2 — SUPERFÍCIES PÚBLICAS

- `/descadastro` (GET + POST one-click) + tokens; `POST /api/outbound/webhooks` com Svix + dedupe + efeitos de supressão; fixtures e testes.
- Gate: webhook de teste do Resend processado no deploy; descadastro e2e verde; one-click validado com mail-tester/Gmail real.

FASE 3 — MOTOR DE ENVIO + PILOTO

- `outbound:plan`/`outbound:send` com rampa, janela, idempotência, circuit breaker; copy da primeira campanha aprovada (§20).
- **Piloto**: 1 indústria, 20–30 contatos da faixa mais quente, semana 1 da rampa.
- Gate: piloto entregue com bounce < 2%, zero complaint, eventos fluindo no banco; decisão consciente de escalar.

FASE 4 — DASHBOARD INTERNO

- Auth + `/interno/outbound` (visão geral, funil, guard-rails, respostas, supressão); gráficos SVG dentro da CSP.
- Gate: dashboard reflete o piloto com números conferidos manualmente contra o Resend; e2e de auth verde.

FASE 5 — ESCALA E REFINAMENTO

- Demais campanhas por indústria (uma por vez, respeitando rampa); classificação de respostas rodando; relatório semanal padrão; avaliar V1.1 (inbound automático §14, correlação automática com leads do site, segunda variante por passo).
- Gate: 2+ campanhas completas com métricas §21 dentro das faixas; retrospectiva escrita (o que cada indústria respondeu melhor).

## 23. CRITÉRIOS DE ACEITE

1. Nenhum e-mail é enviado a contato suprimido, não verificado, fora de campanha `approved` ou sem confirmação do usuário — coberto por teste.
2. Opt-out (página, one-click e resposta manual) suprime globalmente e para a sequência em < 48 h — coberto por e2e.
3. Todo envio carrega `List-Unsubscribe` + `List-Unsubscribe-Post` e identificação legal do remetente.
4. Webhook rejeita assinatura inválida (401) e é idempotente por `svix-id` — coberto por teste com fixtures.
5. Bounce permanente e complaint suprimem e param o enrollment no mesmo evento.
6. Circuit breaker pausa campanha a bounce > 3% e tudo a complaint > 0,1%, cancelando agendados.
7. Dashboard bate com os números do painel do Resend (tolerância de eventos em trânsito) e exibe a ressalva de abertura.
8. Logs e analytics sem PII de destinatários; secrets só em env; `pnpm check` e e2e verdes.
9. Import responde "de onde veio este contato?" para qualquer e-mail da base (lote + origem declarada).
10. Rampa e caps são aplicados pelo motor (não dependem de disciplina humana).

## 24. DECISÕES PENDENTES (BLOQUEIAM FASES)

| #   | Decisão                                                                               | Bloqueia               | Recomendação                                 |
| --- | ------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------- |
| 1   | §2: Opção A (Resend p/ cold, risco aceito), B (híbrido, recomendada) ou C (só opt-in) | Fase 3                 | B; se A, conta separada + mitigação completa |
| 2   | Domínio de envio (irmão vs subdomínio) e sua compra                                   | Fase 0                 | Domínio irmão (ex.: `dreamy.net.br`)         |
| 3   | Ferramenta de verificação de e-mails                                                  | Fase 1                 | MillionVerifier (custo) ou ZeroBounce        |
| 4   | Razão social + CNPJ + cidade para assinatura dos e-mails                              | Fase 3                 | Fornecer (hoje `null` no projeto)            |
| 5   | Confirmação do WhatsApp +55 11 94879-3233 (ADR-013)                                   | assinatura dos e-mails | Confirmar                                    |
| 6   | Caixa `reply_to` monitorada (endereço e quem monitora)                                | Fase 3                 | Definir com o comercial                      |
| 7   | Provedor Postgres (Neon vs alternativa)                                               | Fase 1                 | Neon via Vercel Marketplace                  |
| 8   | Indústrias reais da lista + oferta âncora de cada campanha                            | copy (Fase 3)          | Definir ao receber o Excel                   |
| 9   | Plano Resend (Free → Pro)                                                             | Fase 3 (escala)        | Free na rampa; Pro ao escalar                |

## 25. CONFIGURÁVEIS (ENV)

Somente nomes em `.env.example`; valores nunca commitados. Lista vigente (ADR-023/024 substituíram as propostas originais de senha de dashboard, webhook Svix e tokens de descadastro — voltam nas fases do §29.3):

| Variável                                                              | Uso                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `OUTBOUND_RESEND_API_KEY`                                             | conta Resend dedicada ao outbound (≠ transacional do site)                     |
| `OUTBOUND_FROM` / `OUTBOUND_REPLY_TO`                                 | remetente e caixa de respostas (identidade em `src/lib/outbound/signature.ts`) |
| `OUTBOUND_SEND_WINDOW` / `OUTBOUND_UTC_OFFSET` / `OUTBOUND_DAILY_CAP` | janela, fuso e cap manual (rampa §17 vale o menor)                             |
| `OUTBOUND_STORE_DIR`                                                  | diretório do store em arquivos (dev/demo)                                      |
| `OUTBOUND_DATABASE_URL`                                               | Postgres Neon (pooled) — liga o store hospedado; CLIs e console no mesmo banco |
| `OUTBOUND_TEAM_EMAILS`                                                | allowlist do login por link mágico                                             |
| `OUTBOUND_SESSION_SECRET`                                             | HMAC do cookie de sessão (30 dias)                                             |
| `OUTBOUND_APP_URL`                                                    | base pública dos links de login                                                |
| `OUTBOUND_AUTH_DISABLED`                                              | desliga o login SÓ fora de produção                                            |
| `OUTBOUND_PLATFORM_ONLY`                                              | `/` → console (deploy da plataforma)                                           |

## 26. RISCOS E MITIGAÇÃO

| Risco                                    | Mitigação                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Conta Resend encerrada por AUP (cold)    | §2: decisão consciente; conta+domínio separados; guard-rails mais rígidos que os do Resend; adapter permite trocar de provedor sem reescrita |
| Domínio de envio queimado (bounce/spam)  | Verificação obrigatória, descarte de catch-all, rampa, caps, circuit breaker, domínio irmão descartável                                      |
| Reclamação LGPD/ANPD                     | Legítimo interesse documentado (LIA), origem por lote, identificação completa, opt-out < 48 h, minimização, supressão permanente             |
| Abertura inflada leva a decisões erradas | Hierarquia de métricas §21; ressalva fixa no dashboard; decisão por resposta/reunião                                                         |
| Copy fria viola regras do posicionamento | Copy versionada, aprovada pelo usuário, checagem contra §3/§6 antes de aprovar campanha                                                      |
| Webhook perdido/duplicado                | at-least-once + dedupe por `svix-id`; reconciliação diária opcional via API do Resend                                                        |
| Envio duplicado em retry                 | Idempotency-Key no Resend + unicidade local                                                                                                  |
| Dashboard exposto                        | Auth + rate limit no login + noindex + sem links públicos; PII só autenticado                                                                |
| Vercel ainda sem projeto                 | Pendência externa já mapeada (`docs/DEPLOY.md`); Fases 1 e parte da 3 (dry-run) não dependem de deploy                                       |
| Excel do Clay com colunas imprevisíveis  | Mapa de colunas revisado por lote + relatório de import para aprovação                                                                       |

## 27. REFERÊNCIAS

- Resend: AUP (`resend.com/legal/acceptable-use`) · API send/batch (`resend.com/docs/api-reference/emails/send-batch-emails`) · webhooks + Svix (`resend.com/docs/dashboard/webhooks/*`) · tracking (`resend.com/docs/dashboard/domains/tracking`) · unsubscribe transacional (`resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails`) · domínios/regiões/DMARC (`resend.com/docs/dashboard/domains/*`) · preços (`resend.com/pricing`).
- Gmail/Yahoo bulk sender: `support.google.com/a/answer/14229414` · RFC 8058 (one-click).
- LGPD B2B: art. 7º IX (legítimo interesse), art. 18 (direitos do titular); análises de mercado citadas na pesquisa interna (sessão 2026-08-27).
- Interno: `docs/PRD.md` §2, §8–§10, §112 · `docs/apresentacao/ROTEIRO.md` e `dreamy-pitch.html` (simulador) · `docs/CONTENT-SOURCES.md` · `src/lib/email/index.ts` (padrão de adapter) · `src/app/api/leads/route.ts` (padrão de rota) · `docs/TRACKING.md` (UTMs, PII).

## 28. ADENDO 2026-08-27 — V1 LOCAL IMPLEMENTADA

A pedido do usuário ("eu só envio a lista e os disparos acontecem, de forma automática"), a V1 foi implementada **100% local**, sem esperar deploy/banco. ADRs 019–022 em `docs/DECISIONS.md`.

### 28.1 O que mudou vs. §§9–16

- **Store**: arquivos JSON em `.outbound/` (gitignored; PII nunca commitada) no lugar do Postgres (ADR-019). Interface `OutboundStore` preserva a migração.
- **Eventos**: polling da API do Resend (`outbound:sync`, `GET /emails/:id`) no lugar de webhooks. Webhooks/one-click/dashboard com auth ficam para a fase de produção (antigas Fases 2/4 do §22).
- **Descadastro** (ADR-021): opt-out por resposta (`outbound:reply --suppress`, supressão global permanente) + header `List-Unsubscribe: mailto:`; linha humana de opt-out no E4. One-click HTTPS obrigatório antes de escalar além da rampa.
- **Dashboard** (§16): `/interno/outbound` local (`pnpm dev`), leitura pura, gated com `notFound()` em produção — sem auth nesta fase porque não há deploy.
- **§20 emendado** (ADR-020): confirmação por disparo → **automação armada**. O agente/tarefa agendada dispara sozinho APÓS: copy aprovada por campanha (`outbound:campaign approve --confirm`, lint bloqueante) + arming único e explícito (`outbound:arm arm --confirm`). Salvaguardas estruturais permanecem: rampa/caps/janela no motor, verificação de lista obrigatória, supressão checada a cada plano, breaker automático (bounce ≥ 3% pausa campanha; 1 complaint pausa tudo; religar é humano).
- **Copy**: linter bloqueante em `src/lib/outbound/render.ts` (termos de marketing, frases-carimbo de IA, claims sem fonte, exclamações/caps/emoji, placeholders malformados) — e-mails são texto puro + HTML mínimo espelhado; guia em `src/content/outbound/GUIA-COPY.md`; 3 campanhas-modelo em `src/content/outbound/exemplo-*.ts`.
- **Endurecimento pós-revisão (2026-08-27)**: envio com write-ahead (`pending` gravado ANTES da chamada ao Resend; run interrompido bloqueia envios até `outbound:send --resolve-pending`, sem fantasma nem duplicata); aprovação de copy amarrada a hash do conteúdo (editar copy invalida o approve); cancelamento (breaker/pausa) rebobina o enrollment para não pular passo nunca entregue; reply/opt-out e pausa manual cancelam sends já agendados no Resend; guard-rails contam só e-mails efetivamente processados; lockfile serializa CLIs concorrentes (`.outbound/.lock`).

### 28.5 Console (plataforma de acompanhamento — 2026-08-27, 2ª rodada)

O §16 foi implementado como console multi-página em `/interno/outbound` (local, via `pnpm dev`; gated fora de produção):

- **Páginas**: Visão geral (métrica norte + sparkline de envios/dia + cards por campanha + operação) · detalhe da campanha (funil por passo, **prévia da copy renderizada com badges de lint** — é onde a copy é revisada antes do approve, aviso quando a copy muda após aprovação) · Contatos (busca/filtros, supressão) · Respostas (classificação inline, registro manual) · Atividade (timeline por dia) · Supressão. Assinatura visual: **fio de saúde** — pílulas persistentes com armed/breaker/cap/bounce/complaints/pendings/agendados órfãos.
- **Ações pelo console** (Server Actions conservadoras, PRD §16): pausar/retomar campanha (pausar cancela agendados), registrar/classificar resposta, suprimir contato, desarmar. **Armar e disparar continuam exclusivos da CLI** (ADR-020). Ações com opt-out cancelam agendados no Resend; sem `OUTBOUND_RESEND_API_KEY`, os não-cancelados aparecem como "agendados órfãos" no fio de saúde.
- **Modo demonstração**: `pnpm outbound:demo` povoa `.outbound-demo/` (dados 100% simulados, e-mails `.example`, banner DEMO em toda página) e `/interno/outbound?demo=1` mostra a plataforma inteira funcionando antes da lista real. O store real nunca é tocado.
- **QA**: revisão adversarial (10 achados confirmados e corrigidos — entre eles opt-out em resposta "ooo" que não cancelava agendados, métrica de taxa de resposta divergente entre páginas e corrida no e2e); e2e próprio com axe (WCAG 2.2 AA) e mutação real de pausa; screenshots 390/768/1440 em `docs/qa/outbound-console/`; 208 testes unitários + 70 e2e verdes.

### 28.2 Fluxo operacional (comandos)

1. `pnpm outbound:import --file lista.xlsx --origin "Clay run X"` — importa PESSOAS com validação/dedupe/origem (LGPD §18). O Clay exporta empresas e pessoas em tabelas separadas: `pnpm outbound:companies import --file empresas.xlsx --origin "..."` importa a de EMPRESAS (descrição, porte, nº de clientes/ticket do enriquecimento) e o import de pessoas faz join automático por domínio — preenchendo empresa/indústria/porte e injetando variáveis custom ({{abertura}}, {{clientes_ativos}}) nos templates. `outbound:companies enrich-contacts` re-aplica o join em contatos já importados.
2. `pnpm outbound:verify --export para-verificar.csv` → verificador externo → `--results resultado.csv` (ou `--assume-ok --confirm`, risco do usuário).
3. Escrever campanha por indústria em `src/content/outbound/` (copiar exemplo; `status: "ready"`).
4. `pnpm outbound:campaign approve --slug <x> --by "<nome>" --confirm` e `pnpm outbound:campaign enroll --slug <x>`.
5. `pnpm outbound:arm arm --confirm` (uma vez) + tarefa agendada `scripts/outbound/install-schedule.ps1` (usuário roda uma vez).
6. Diário (automático): `pnpm outbound:auto` = sync → plan → send → report. Acompanhamento: `pnpm outbound:report` e `/interno/outbound`.
7. Respostas: `pnpm outbound:reply --email <e-mail> --class interested|...` (opt-out: `--suppress`).

### 28.3 Trilha para produção

Deploy Vercel + Postgres + webhooks Svix + one-click RFC 8058 + auth do dashboard (antigas Fases 2/4 do §22) — sem mudança de modelo de dados (mesmos tipos).

### 28.4 Pendências que bloqueiam o primeiro envio real

1. ~~Lista de PESSOAS~~ ✅ 2026-08-27: o workbook `Luigi_CONSTRUCAO.xlsx` tem as abas "Empresas" (99 importadas e segmentadas) e "Pessoas" (100 linhas → 41 ativos no ICP, 38 gerentes/supervisores excluídos com motivo, 19 sem e-mail de trabalho, 2 duplicados). Importar com `--sheet Pessoas`.
2. ~~`OUTBOUND_RESEND_API_KEY`~~ ✅ 2026-08-27: chave em `.env.local` (conta dedicada; ao armar, o usuário assume o risco da Opção A do §2).
3. Domínio de envio: **bedreamy.com.br** já criado no Resend (região `sa-east-1`) com DKIM + SPF verificados; falta só o MX de recebimento na raiz (opcional — só para Resend Inbound) e o **DMARC** (`_dmarc` TXT `v=DMARC1; p=none; rua=mailto:...` — §17). Definidos em 2026-08-29: `OUTBOUND_FROM = Luigi Choffe <contact@bedreamy.com.br>` e `OUTBOUND_REPLY_TO = contact@bedreamy.com.br` (caixa real na Hostinger — as respostas são o CTA). O MX de recebimento do Resend não é usado (respostas chegam na Hostinger); DMARC já existia (`p=none`).
   3b. **Verificação da lista** (§11): exportar com `outbound:verify --export` e validar em verificador externo (ZeroBounce/MillionVerifier — 41 e-mails cabem no free tier) antes do 1º envio; ou `--assume-ok --confirm` assumindo o risco.
4. Razão social/CNPJ para identificação legal na assinatura (§18 — hoje `null`; adicionar à copy quando fornecido).
5. Copy real por indústria aprovada + `outbound:arm arm --confirm`.

## 29. PLATAFORMA HOSPEDADA (PIVÔ 2026-08-29)

### 29.1 O que muda

- **Este repositório deixa de ser o site institucional da Dreamy e vira a plataforma de vendas**: o console `/interno/outbound` hospedado na Vercel, com acesso por e-mail para o time, e o MORK (`.agents/mork/`) operando por trás. O site foi duplicado e passa a ser hospedado pelo sócio em outro lugar. `docs/PRD.md` continua sendo a fonte de posicionamento/copy (a oferta não mudou); as páginas de marketing deste repo entram em modo de remoção (29.3, P5).
- O deploy deste repo sai **noindex** (ADR-017: `NEXT_PUBLIC_SITE_ENV=production` nunca é definido aqui), para o site duplicado não concorrer com o oficial; o console já é `noindex` por rota. Com `OUTBOUND_PLATFORM_ONLY=true` (env do projeto Vercel; regra em `next.config.ts`) a raiz `/` redireciona (307) para `/interno/outbound` — o deploy se comporta como plataforma mesmo com as páginas do site ainda no código.
- Domínio da plataforma: `mork.bedreamy.com.br` (CNAME na Hostinger → Vercel). `bedreamy.com.br` segue como domínio de envio (§17, §28.4) — o CNAME no subdomínio não interfere no e-mail.
- Propostas de banco/auth dos §§9, 16, 19 e 25 são substituídas pelas decisões abaixo (ADR-023/024): não existe `OUTBOUND_DASHBOARD_PASSWORD`; `OUTBOUND_DATABASE_URL` confirmada; `OUTBOUND_RESEND_WEBHOOK_SECRET` e `OUTBOUND_UNSUB_TOKEN_SECRET` ficam para as fases de 29.3.

### 29.2 Arquitetura

```
   Time (allowlist OUTBOUND_TEAM_EMAILS)
        │ link mágico via Resend → cookie HMAC (30 dias)
        ▼
   Vercel · Next.js · https://mork.bedreamy.com.br   (OUTBOUND_PLATFORM_ONLY=true: "/" → /interno/outbound)
   /interno/login · /api/outbound/auth/callback · /interno/logout · guard em src/proxy.ts
   /interno/outbound (+ subrotas) — Server Actions conservadoras (§16, §28.5)
        │  @neondatabase/serverless
        ▼
   Postgres Neon (Storage do projeto Vercel; OUTBOUND_DATABASE_URL pooled) ◄──────────────┐
        contatos · empresas · campanhas · enrollments · envios · eventos ·                │
        supressão · respostas · imports · estado (armed/breaker) · lock                   │ mesma env no .env.local
                                                                                          │
   PC do Luigi: pnpm outbound:* + tarefa DreamyOutboundAuto (dias úteis 09:05) ───────────┘
        │
        ▼
   Resend (envio batch + agendamento; eventos por polling — §28.1; e-mail do link de login)
```

- **Banco** (ADR-023): adapter Postgres do `OutboundStore` escolhido pela presença de `OUTBOUND_DATABASE_URL`; sem a env, store em arquivos (`.outbound/`) — dev/demo. `pnpm outbound:db migrate | push [--confirm] | pull [--dir] | status` (`push` recusa sobrescrever banco com dados sem `--confirm`). Testes do adapter com pglite.
- **Auth** (ADR-024): link mágico + allowlist + cookie HMAC; guard em `src/proxy.ts` para `/interno/*` e `/api/outbound/*`; `OUTBOUND_AUTH_DISABLED=true` só fora de produção. Sem provedor externo.
- **Operação**: inalterada (§28.2, ADR-020). Armar e disparar continuam na CLI; o console segue com ações conservadoras. A tarefa agendada continua no PC do Luigi apontando para o mesmo banco — nesta fase a Vercel só hospeda o console.
- **Env** (nomes em `.env.example`): novas `OUTBOUND_PLATFORM_ONLY`, `OUTBOUND_DATABASE_URL`, `OUTBOUND_TEAM_EMAILS`, `OUTBOUND_SESSION_SECRET`, `OUTBOUND_APP_URL`, `OUTBOUND_AUTH_DISABLED` (dev) + as existentes (`OUTBOUND_RESEND_API_KEY`, `OUTBOUND_FROM`, `OUTBOUND_REPLY_TO`, janela/cap). A tabela do §25 fica superada por esta lista.
- **Deploy**: passo a passo em `docs/DEPLOY-PLATAFORMA.md` (import pelo painel — a integração local não cria projeto; Storage → Neon; envs; `outbound:db migrate/push`; domínio; primeiro login; checklist; gestão do time).

### 29.3 Fases seguintes (roadmap — nada disto está feito)

| Fase                               | Entrega                                                                                                                                                                                         | Gate                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P1 — Console hospedado (esta)      | Vercel + Neon + auth; CLIs locais no mesmo banco; `OUTBOUND_PLATFORM_ONLY`                                                                                                                      | time logando em `mork.bedreamy.com.br`; `outbound:report` e console batendo       |
| P2 — Ciclo diário na nuvem         | Vercel Cron chamando o ciclo `auto` (sync → plan → send → report) por rota protegida; tarefa Windows desligada                                                                                  | 1 semana de disparos sem o PC do Luigi ligado                                     |
| P3 — Eventos e opt-out sem polling | webhooks Resend (Svix, §13) no lugar de `outbound:sync`; one-click unsubscribe HTTPS RFC 8058 (`/descadastro`, §15, ADR-021)                                                                    | webhook de teste processado; one-click validado em Gmail real                     |
| P4 — Respostas automáticas         | Resend Inbound / leitura da caixa `reply_to` → registro automático da resposta (§14 V1.1); classificação segue humana/MORK                                                                      | respostas aparecendo no console no mesmo dia                                      |
| P5 — Plataforma pura               | remover as páginas do site marketing deste repo; `/` vira a plataforma (login/console) sem redirect; README, `.agents/rules/` e referências a `docs/PRD.md` reposicionados; smoke da plataforma | `pnpm check` verde sem `src/app/(site)`; `pnpm smoke` reescrito para a plataforma |

Notas: Vercel Hobby limita Cron a 1 execução/dia com precisão de hora (o `send` agenda no Resend, então o minuto exato não importa) e funções a ≤ 300 s — o ciclo cabe. Se a Vercel exigir plano comercial (Hobby é uso pessoal), migrar para Pro sem mudança de código.
