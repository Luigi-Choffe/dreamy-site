# PLAYBOOK do MORK — como operar a máquina de outbound

> Manual operacional. Identidade em `MORK.md`. Especificação completa em
> `docs/PRD-EMAIL-OUTBOUND.md` (§28 = implementado, §29 = plataforma hospedada). Comandos rodam na raiz do repo.

## 0. Check-in de toda sessão

```bash
pnpm outbound:arm status      # armada? breaker? cap do dia? env presente?
pnpm outbound:report          # funil por campanha, guard-rails, supressões
pnpm outbound:campaign list   # campanhas, aprovação, pausa, bounce por campanha
```

Console visual: hospedado em https://mork.bedreamy.com.br/interno/outbound (login
por e-mail da allowlist; mesmo banco dos CLIs) ou local `pnpm dev` →
http://localhost:3000/interno/outbound (demo para mostrar a plataforma:
`pnpm outbound:demo` → `?demo=1`). Banco: `pnpm outbound:db status`.
Sinais vermelhos no fio de saúde: `pending` (run interrompido → `outbound:send
--resolve-pending`, conferindo o painel do Resend antes) e `agendados órfãos`
(cancelar no painel do Resend ou repetir a ação com a chave presente).

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

## 4. Relatório semanal ao Luigi (sexta ou quando pedir)

Fonte: `outbound:report` + console. Formato: (1) respostas e INTERESSADOS
primeiro, com nomes/empresas; (2) entregas/bounces por campanha vs guard-rails;
(3) o que a rampa permite semana que vem; (4) recomendação: próximo segmento a
atacar, ajuste de ângulo, novo ICP a testar. Honestidade sempre: abertura só
como tendência; número ruim se reporta igual número bom.

## 5. Mapa de arquivos

| O quê                                 | Onde                                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade/regras do MORK             | `.agents/mork/MORK.md`                                                                                                                                                                          |
| Motor, store, lint, assinatura        | `src/lib/outbound/` (assinatura: `signature.ts`)                                                                                                                                                |
| CLIs                                  | `scripts/outbound/` · utilitários one-shot em `scripts/dev/`                                                                                                                                    |
| Copy das campanhas + guia             | `src/content/outbound/`                                                                                                                                                                         |
| Console (código)                      | `src/app/interno/outbound/` · guard de login `src/proxy.ts` · rotas `/interno/login`, `/api/outbound/auth/callback`, `/interno/logout`                                                          |
| Console (hospedado)                   | https://mork.bedreamy.com.br/interno/outbound — Vercel, login por link mágico (allowlist `OUTBOUND_TEAM_EMAILS`)                                                                                |
| Dados vivos (PII)                     | banco Postgres Neon (`OUTBOUND_DATABASE_URL`, compartilhado console ↔ CLIs) · sem a env: `.outbound/` (dev/demo) · planilhas em `docs/CONTATOS/` · backups `pnpm outbound:db pull` (gitignored) |
| Env (chave Resend, from/reply, banco) | `.env.local` no PC · Vercel → Settings → Environment Variables (nomes em `.env.example`)                                                                                                        |
| Deploy da plataforma                  | `docs/DEPLOY-PLATAFORMA.md`                                                                                                                                                                     |
| Spec e decisões                       | `docs/PRD-EMAIL-OUTBOUND.md` (§28 operação, §29 plataforma) · ADR-019…024 em `docs/DECISIONS.md`                                                                                                |

## 6. Estado em 2026-08-30 (atualizar quando mudar de fase)

Campanha `construcao-nova-receita` (16 incorporadoras SP) aprovada e ARMADA;
1º disparo 2026-08-31 09:05 (15 E1 + 1 na terça) pela tarefa local
`DreamyOutboundAuto` (PC do Luigi ligado). 42 contatos ativos no store
(17 obras p/ terceiros, 6 serviços de engenharia e 2 fornecedores ainda SEM
campanha — próximos alvos; obras → âncora Sistemas Sob Medida). Domínio
bedreamy.com.br (DKIM/SPF ok, respostas via Hostinger). Tracking de
abertura/clique desligado por decisão (entregabilidade > pixel).

**Pivô 2026-08-29 — plataforma hospedada** (PRD §29, ADR-023/024): o repo virou
a plataforma de vendas da Dreamy; o site institucional ficou com o sócio. Console
na Vercel em `mork.bedreamy.com.br` (login por link mágico para e-mails da
allowlist; `OUTBOUND_PLATFORM_ONLY=true` manda `/` para o console) com banco
Postgres Neon **compartilhado** com os CLIs (`OUTBOUND_DATABASE_URL` no
`.env.local`; sem a env, `.outbound/`). Deploy ainda NÃO feito: depende de o
Luigi importar o repo na Vercel (`docs/DEPLOY-PLATAFORMA.md`). Até o
`pnpm outbound:db push`, o estado vivo está em `.outbound/`; depois, no banco —
mesmos comandos, mesma leitura. Pendências: corrigir domínio do Grupo Impper no
Clay (veio rdstation.com); Vercel Cron, webhooks, one-click e respostas
automáticas = fases P2–P4 do PRD §29.3.
