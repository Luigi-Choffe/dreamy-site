# PLAYBOOK do MORK — como operar a máquina de outbound

> Manual operacional. Identidade em `MORK.md`. Especificação completa em
> `docs/PRD-EMAIL-OUTBOUND.md` (§28 = implementado, §29 = plataforma hospedada). Comandos rodam na raiz do repo.

## 0. Check-in de toda sessão

```bash
pnpm outbound:arm status      # armada? breaker? cap do dia? env presente?
pnpm outbound:report          # funil por campanha, guard-rails, supressões
pnpm outbound:campaign list   # campanhas, aprovação, pausa, bounce por campanha
pnpm outbound:demandas list          # fila do time (claim ao começar, done ao entregar)
pnpm outbound:crm task list --today  # tarefas de hoje e vencidas (follow-up de interessado!)
pnpm outbound:crm reconcile          # pipeline acompanha o outbound (idempotente)
```

Console visual: hospedado em https://mork.bedreamy.com.br/interno/outbound (login
por e-mail da allowlist; mesmo banco dos CLIs) ou local `pnpm dev` →
http://localhost:3000/interno/outbound (demo para mostrar a plataforma:
`pnpm outbound:demo` → `?demo=1`). Banco: `pnpm outbound:db status`.
Sinais vermelhos no fio de saúde: `pending` (run interrompido → `outbound:send
--resolve-pending`, conferindo o painel do Resend antes) e `agendados órfãos`
(cancelar no painel do Resend ou repetir a ação com a chave presente).

**Toque prévio no LinkedIn (desde 2026-09-10):** o ciclo gera no Hoje a fila
"Conectar antes do E1" (quem recebe E1 hoje/próximo dia de envio e tem perfil);
o Luigi abre o perfil, manda o convite sem mensagem e marca "Convite enviado".
`pnpm outbound:crm toques` gera/lista pela CLI. O resultado vai para
`custom.toque_previo` do contato: comparar resposta com vs. sem toque no
relatório semanal.

**Falhas e salvaguardas (regra do Luigi, 2026-09-10):** toda falha entra em
`docs/FALHAS-E-SALVAGUARDAS.md` com causa, correção e a salvaguarda que impede
a volta (teste, config ou checklist). Lá vivem o **pré-voo de segunda** (tarefa
agendada com 3 gatilhos e resultado 0, arm status, plan sem alerta de aprovação,
lock sem órfão) e o **checklist de importação** (grafias unificadas, domínio
divergente = reserva, validador de peças tudo-ou-nada, `apply-colegas --dry-run`
batendo com as empresas de contato único). Ler antes de qualquer lista nova.

## 1. Base nova do Clay (novo ICP ou reforço)

O Clay exporta EMPRESAS e PESSOAS (abas ou arquivos separados). Planilhas vão
para `docs/CONTATOS/` (gitignored — PII nunca no git).

```bash
# 1. abas do arquivo
pnpm tsx scripts/dev/list-sheets.ts docs/CONTATOS/<arquivo>.xlsx

# 2. EMPRESAS primeiro (enriquecimento + join por domínio)
pnpm outbound:companies import --file <arq> --sheet <aba> --origin "Clay <run>, <data>" --dry-run
#    cabeçalhos novos? ajustar aliases em scripts/outbound/companies.ts
#    depois rodar sem --dry-run

# 3. PESSOAS (dry-run primeiro; cabeçalhos → scripts/outbound/import-map.ts)
pnpm outbound:import --file <arq> --sheet <aba> --origin "Clay <run>, <data>" --dry-run
#    conferir: excluídos por cargo fazem sentido? e-mails ausentes? depois: sem --dry-run

# 4. verificação de entregabilidade (padrão: verificar; pular só com ordem do Luigi)
pnpm outbound:verify --export docs/CONTATOS/para-verificar.csv   # → ZeroBounce/MillionVerifier
pnpm outbound:verify --results <resultado>.csv                   # ou: --assume-ok --confirm
```

Depois: **segmentar** (agente classifica descrições → `scripts/dev/apply-segmentos.ts`),
**aberturas** (workflow de redatores com as regras do lote construção: ≤26 palavras,
minúscula, ponto final, concreta da descrição, sem elogio, sem travessão, sem {{}};
validar TODAS com `scripts/dev/merge-aberturas.ts` antes de `--apply`) e reportar ao
Luigi: contagens, segmentos, anomalias (domínio errado tipo o caso rdstation/Impper).

## 2. Campanha nova

1. Copiar um modelo de `src/content/outbound/`, seguir `GUIA-COPY.md` à risca
   (voz do Luigi; 4 passos 0/+3/+7/+7; E1 sem link com {{abertura}}; E3 com link
   UTM `utm_campaign=<slug>`; E4 com opt-out humano; ZERO travessão).
2. `industria` da campanha = segmento curado (ex.: "construção incorporadora").
3. Registrar em `src/content/outbound/index.ts` + `pnpm test -- outbound-campaigns`.
4. Validar contra contatos reais: `pnpm tsx scripts/dev/lint-all-enrolled.ts` (ajustar slug).
5. Prévia para o Luigi: `scripts/dev/html-preview.ts` → SendUserFile (e a página
   `/interno/outbound/<slug>` mostra o mesmo).
6. **Com o "aprovo" do Luigi** (nunca antes):
   ```bash
   pnpm outbound:campaign approve --slug <slug> --by "Luigi Choffe" --confirm
   pnpm outbound:campaign enroll --slug <slug>
   ```
   (Editou copy depois? O hash invalida sozinho — repetir o approve com novo OK.)

## 3. Dia a dia (automático) e intervenções

Tarefa Windows **DreamyOutboundAuto** roda `pnpm outbound:auto` (dias úteis
09:05; log `.outbound/auto.log`): sync → plan → send → report. Manualmente:
`outbound:plan` (dry-run de leitura), `outbound:send` (sem `--confirm` = dry-run).

| Situação                                  | Ação                                                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resposta na caixa contact@bedreamy.com.br | `pnpm outbound:reply --email <e-mail> --class interested\|not_now\|referral\|negative\|ooo\|other [--notes] [--suppress]` no MESMO dia; interessado → resumo pronto pro Luigi (quem, empresa, abertura usada, o que respondeu) |
| Pedido de remoção (qualquer forma)        | `--suppress` imediato; conferir no report que os agendados foram cancelados                                                                                                                                                    |
| Bounce ≥ 3% numa campanha                 | pausa sozinho; investigar lote/domínio antes de `campaign resume`                                                                                                                                                              |
| Complaint                                 | breaker global para TUDO; só o Luigi decide religar (`arm reset-breaker --confirm`)                                                                                                                                            |
| Pausar uma campanha                       | `pnpm outbound:campaign pause --slug <x> --reason "..."` (cancela agendados)                                                                                                                                                   |
| Pânico geral                              | `pnpm outbound:arm disarm`                                                                                                                                                                                                     |
| Demanda nova na fila (aba Demandas)       | `pnpm outbound:demandas claim --id <id>` ao começar · `done --id <id> --resolution "..."` ao entregar · recusar exige `--motivo`; toda transição vira prestação de contas na aba MORK                                          |
| Interessado classificado                  | a tarefa de follow-up nasce sozinha; conferir em `pnpm outbound:crm task list --today` e mover o negócio no pipeline quando marcar reunião                                                                                     |

## 4. Relatório semanal ao Luigi (sexta ou quando pedir)

Fonte: `outbound:report` + console. Formato: (1) respostas e INTERESSADOS
primeiro, com nomes/empresas; (2) entregas/bounces por campanha vs guard-rails;
(3) o que a rampa permite semana que vem; (4) recomendação: próximo segmento a
atacar, ajuste de ângulo, novo ICP a testar. Honestidade sempre: abertura só
como tendência; número ruim se reporta igual número bom.

## 5. Mapa de arquivos

| O quê                                  | Onde                                                                                                                                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade/regras do MORK              | `.agents/mork/MORK.md`                                                                                                                                                                                                                         |
| Motor, store, lint, assinatura         | `src/lib/outbound/` (assinatura: `signature.ts`)                                                                                                                                                                                               |
| CLIs                                   | `scripts/outbound/` · utilitários one-shot em `scripts/dev/`                                                                                                                                                                                   |
| Copy das campanhas + guia              | `src/content/outbound/`                                                                                                                                                                                                                        |
| Console (código)                       | `src/app/interno/outbound/` · guard de login `src/proxy.ts` · rotas `/interno/login`, `/api/outbound/auth/callback`, `/interno/logout`                                                                                                         |
| Console (hospedado)                    | https://mork.bedreamy.com.br/interno/outbound — Vercel, login por link mágico (allowlist `OUTBOUND_TEAM_EMAILS`)                                                                                                                               |
| Dados vivos (PII)                      | banco Postgres Neon (`OUTBOUND_DATABASE_URL`, compartilhado console ↔ CLIs) · sem a env: `.outbound/` (dev/demo) · planilhas em `docs/CONTATOS/` · backups `pnpm outbound:db pull` (gitignored)                                                |
| Env (chave Resend, from/reply, banco)  | `.env.local` no PC · Vercel → Settings → Environment Variables (nomes em `.env.example`)                                                                                                                                                       |
| Deploy da plataforma                   | `docs/DEPLOY-PLATAFORMA.md`                                                                                                                                                                                                                    |
| CRM piloto (núcleo, IA, demandas)      | `src/lib/outbound/crm-core.ts`, `demands-core.ts`, `ai.ts`, `agent-log.ts` · CLIs `outbound:crm`, `outbound:demandas` · páginas pipeline, hoje, contatos/[id], demandas, mork, configuracao                                                    |
| Aquário (organograma vivo do time)     | src/lib/outbound/team.ts (cadeiras + status derivado das demandas) · src/app/interno/outbound/aquario.tsx + aquario-rede.tsx (canvas) · fixo à direita em telas largas; aba MORK nas demais                                                    |
| Agenda (futuro da operação, dia a dia) | src/lib/outbound/agenda-core.ts (forecast puro do computePlan + merge de tarefas/reuniões) · página /interno/outbound/agenda · Stat Amanhã na cadência na visão geral                                                                          |
| Time de agentes (subagentes do MORK)   | `.claude/agents/` (slugs internos estáveis): NIX=verbo (copy), THAO=garimpo (leads/ICP), TAY=trato (respostas/CRM), ZED=forja (plataforma) — nomes públicos curtos desde 2026-09-02; 5ª vaga MIRA reservada; demitir só com permissão do Luigi |
| Spec e decisões                        | `docs/PRD-EMAIL-OUTBOUND.md` (§28 operação, §29 plataforma) · ADR-019…024 em `docs/DECISIONS.md`                                                                                                                                               |

## 6. Estado em 2026-09-01 (atualizar quando mudar de fase)

**3 campanhas reais aprovadas e rodando** (todas na voz do Luigi, rampa comum):

- `construcao-nova-receita` (16 incorporadoras · nova-receita): 16/16 E1 na rua
  (15 entregues seg 2026-08-31, 16º ter 2026-09-01); E2 na quinta pela cadência.
- `obras-sistemas-sob-medida` (17 obras p/ terceiros · sistema): aprovada
  2026-09-01 ("Pode seguir! Está aprovado!"); 8 E1 agendados no mesmo dia,
  9 restantes no ciclo de 2026-09-02.
- `engenharia-agentes-ia` (6 serviços de engenharia · agente-ia): aprovada
  2026-09-01; 6/6 E1 agendados no mesmo dia.

2 fornecedores sem campanha (volume baixo; ICP futuro). 1º disparo geral foi
2026-08-31 09:05 pela tarefa `DreamyOutboundAuto` (PC do Luigi ligado); 0 bounce,
0 complaint até aqui. Validação pré-inscrição de campanha nova:
`pnpm tsx scripts/dev/lint-campanha-alvo.ts <slug>` (renderiza e linta contra os
contatos reais do segmento). Domínio bedreamy.com.br (DKIM/SPF ok, respostas via
Hostinger). Tracking de abertura/clique desligado por decisão
(entregabilidade > pixel).

**Pivô 2026-08-29 — plataforma hospedada** (PRD §29, ADR-023/024): o repo virou
a plataforma de vendas da Dreamy; o site institucional ficou com o sócio. Console
na Vercel em `mork.bedreamy.com.br` (login por link mágico para e-mails da
allowlist; `OUTBOUND_PLATFORM_ONLY=true` manda `/` para o console) com banco
Postgres Neon **compartilhado** com os CLIs (`OUTBOUND_DATABASE_URL` no
`.env.local`; sem a env, `.outbound/`). **Deploy em andamento (2026-08-30)**: o
Luigi já criou o projeto Vercel `dreamy-site` no time dele (`luigichoffedremay`,
URL `https://dreamy-site-murex.vercel.app`, build do commit e7abee2 OK — login
respondendo) e conectou o Neon ao projeto (Production+Preview; envs criadas com
prefixo `STORAGE_*` ou `DATABASE_*`). **Feito na tarde de 2026-08-30**: itens 3 e 4 (as 8 envs na Vercel + Redeploy; banco migrado com `outbound:db migrate`/`push`: 79 contatos, 99 empresas, 16 enrollments, armada SIM — CLIs e console no MESMO banco; allowlist contact@bedreamy.com.br + luigi.lgv@hotmail.com). **Falta**: login de teste do Luigi e item 5 (CNAME `mork` na Hostinger e trocar `OUTBOUND_APP_URL`). O MCP Vercel desta máquina é de outra conta (403):
tudo na Vercel é clique do Luigi. Até o `push`, o estado vivo está em
`.outbound/`; depois, no banco — mesmos comandos, mesma leitura. Pendências: corrigir domínio do Grupo Impper no
Clay (veio rdstation.com); Vercel Cron, webhooks, one-click e respostas
automáticas = fases P2–P4 do PRD §29.3.

**CRM piloto (2026-08-30, ADR-025)**: a plataforma virou o piloto do CRM da
Dreamy (o MORK é o produto; a validação é ser vendido a outro cliente).
Implementado por cima do console, motor de envio intocado: pipeline kanban
(8 estágios; novo/contatado/respondeu automáticos via `outbound:crm reconcile`),
conta do contato com timeline/notas/tarefas, aba Hoje (interested classificado
gera tarefa de follow-up sozinho), fila de Demandas (console ↔
`outbound:demandas`), painel MORK (prestação de contas), IA env-gated
(`OUTBOUND_ANTHROPIC_API_KEY`: briefing do dia + sugestão de triagem; gate
humano SEMPRE, prompt sem PII), funil de valor na visão geral e Configuração de
marca (apresentação apenas). Time de subagentes em `.claude/agents/`: VERBO
(copy), GARIMPO (leads/ICP), TRATO (respostas/CRM), FORJA (plataforma); 5ª vaga
(MIRA, análise) reservada — demitir exige permissão do Luigi. Ritual novo no §0.
