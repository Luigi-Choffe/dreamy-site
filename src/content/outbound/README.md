# Campanhas de outbound (copy versionada)

O que vive aqui:

- `index.ts` — registry: todas as campanhas que o CLI e o dashboard enxergam (slug único, valida em import).
- `exemplo-*.ts` — três campanhas-modelo (uma por oferta âncora), `status: "draft"`, `industria: "exemplo"`.
  Servem de base para as campanhas reais; nunca são elegíveis para envio.
- `GUIA-COPY.md` — o manual de escrita: princípios, o que o lint bloqueia, RUIM → BOM, regra de prova.

Copy é conteúdo, não código: mudança de copy = commit neste diretório (auditável, PRD outbound §20).

## Criar campanha nova

1. Copie o `exemplo-*.ts` da oferta âncora escolhida para `<industria>-<aaaa-mm>.ts`.
2. Troque `slug` (o `utm_campaign` do link do E3 acompanha, hardcoded) e escreva a cena do E1
   no vocabulário do setor — GUIA-COPY.md manda no resto.
3. `industria` precisa bater com o valor **normalizado** da coluna indústria da lista importada
   (é assim que o plano acha os contatos da campanha).
4. Registre no array de `index.ts` e rode `pnpm test -- outbound-campaigns` até zero erros.
5. Marque `status: "ready"` quando a copy estiver pronta. Envio ainda depende de aprovação
   explícita do usuário: `pnpm outbound:campaign approve` (registrada no store, fora do código).

## Fluxo completo

```bash
pnpm outbound:import --file lista.xlsx --origin "Clay run X (fontes: ...)"  # 1. importar lista
pnpm outbound:verify --export para-verificar.csv                            # 2a. exportar p/ verificador externo
pnpm outbound:verify --results resultado.csv                                # 2b. só e-mail "ok" entra
pnpm outbound:campaign approve --slug <slug> --by "Luigi" --confirm        # 3. usuário aprova a copy
pnpm outbound:campaign enroll --slug <slug>                                 # 4. inscrever contatos da indústria
pnpm outbound:arm arm --confirm                                             # 5. armar a automação (uma vez)
pnpm outbound:auto                                                          # 6. ciclo diário: sync → plan → send → report
```

`outbound:plan` / `outbound:send` (sem `--confirm` = dry-run) servem para operar manualmente;
`scripts/outbound/install-schedule.ps1` agenda o `outbound:auto` em dias úteis às 09:05.
Nenhum envio real sem: lista verificada, campanha `ready` + aprovada e automação armada
(PRD outbound §28.2 / ADR-020). Limites e guard-rails: `docs/PRD-EMAIL-OUTBOUND.md` §§17, 21.
