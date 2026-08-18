# CONTENT-SOURCES — Registro de integridade da prova (PRD §18)

Todo dado comercial exibido no site (métrica, indicador, case, logo, resultado) precisa de uma entrada aqui com origem verificável e aprovação explícita. **Nenhum indicador entra no código sem `Approved for public website: yes`.**

Regra técnica: os itens só são renderizados quando marcados como verificados/aprovados/autorizados em `src/content/proof.ts` (métricas e logos) ou no frontmatter `approved: true` (cases). O build falha se um item marcado como público não tiver `sourceRef` apontando para uma entrada deste arquivo.

## Como registrar um claim

```
Claim:
"<texto exato exibido no site>"

Source:
[documento / analytics / banco / contrato] — link ou caminho interno

Verified:
yes | no   (por quem, quando)

Approved for public website:
yes | no   (por quem, quando)

sourceRef:
<id único usado no código, ex.: metric-requests-monthly>
```

## Claims encontrados no site atual — STATUS: NÃO VERIFICADOS (não publicar)

Estes números aparecem no site Framer atual. Não há fonte documentada. Ficam **fora** do novo site até verificação.

Claim: "+70.000 Requisições por Mês" — Source: desconhecida — Verified: no — Approved: no — sourceRef: metric-requests-monthly
Claim: "5M+ Tokens/Mês" — Source: desconhecida — Verified: no — Approved: no — sourceRef: metric-tokens-monthly
Claim: "+34 Projetos" — Source: desconhecida — Verified: no — Approved: no — sourceRef: metric-projects-delivered

## Logos encontrados no site atual — STATUS: AUTORIZAÇÃO NÃO CONFIRMADA (não publicar)

Metrifique.se · BeTopVoice · Spotify · hs&e (Homo Sapiens Evolutione) · Cultura Soluções Estratégicas
Para publicar: registrar autorização escrita do cliente (e-mail/contrato), data e responsável; adicionar em `src/content/proof.ts` com `authorized: true` e `sourceRef`.

## Depoimentos encontrados no site atual — REMOVIDOS DEFINITIVAMENTE

"Carla Mendes — Studio Criativo" e "Ricardo Azevedo — TechSolutions": PRD proíbe depoimentos; não existe campo de testimonial no modelo de conteúdo.

## Cases — STATUS: NENHUM APROVADO

Não existe case documentado com aprovação do cliente. Template: `src/content/cases/_TEMPLATE.mdx.example`. Para publicar: preencher, obter aprovação escrita do cliente (nome, setor, screenshots, resultados), registrar aqui e marcar `approved: true`.

Case candidato observado nos assets (fotos de palestra/evento esportivo, screenshots de produto B2C "Surpreenda"): **sem contexto nem autorização** — não usar.

## Dados institucionais

| Dado                | Valor             | Fonte                                                                      | Status                                                |
| ------------------- | ----------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| WhatsApp comercial  | +55 11 94879-3233 | site atual (`wa.me/5511948793233`) e deck `DREAMY_INST_v2.pptx` (slide 14) | público existente — **confirmar antes do lançamento** |
| Domínio             | www.dreamy.app.br | PRD                                                                        | ok                                                    |
| Razão social / CNPJ | —                 | não encontrado                                                             | pendente (omitido no site)                            |
| E-mail de contato   | —                 | não encontrado                                                             | pendente (omitido no site)                            |
| Endereço            | —                 | não encontrado                                                             | pendente (omitido no site)                            |
| LinkedIn / redes    | —                 | site atual usa links genéricos de template                                 | pendente (omitido no site)                            |
| GA4 existente       | G-5K32R2LMG3      | site atual                                                                 | decidir reutilização dentro do GTM                    |

## Copy autoral (fora do texto literal do PRD) — para revisão da Dreamy

O PRD fornece copy literal para a maior parte das seções. Onde o PRD entrega apenas estrutura, a copy foi escrita sem claims, métricas ou promessas, mantendo o tom do PRD. Lista completa em `docs/COPY-REVIEW.md`.
