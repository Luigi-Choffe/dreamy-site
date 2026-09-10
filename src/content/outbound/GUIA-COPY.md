# Guia de copy — Dreamy Outbound

Manual para escrever (e revisar) as sequências de cold e-mail. Vale para o agente e para humanos.
Base: `docs/PRD-EMAIL-OUTBOUND.md` §§3, 5–8 e o lint em `src/lib/outbound/render.ts` — toda copy
precisa passar em `lintEmail` com zero erros (o teste `tests/unit/outbound-campaigns.test.ts` cobra isso).

## O princípio único

**O e-mail tem que parecer escrito por uma pessoa ocupada para outra pessoa ocupada.**

Não é e-mail marketing. Não é newsletter. Não é "comunicado". É uma pessoa da Dreamy escrevendo
para um diretor sobre um problema que ele reconhece. Tudo o que quebra essa ilusão — formatação,
vocabulário de campanha, frases de mala direta, elogio genérico — é defeito.

O espírito da casa ("Começamos pelo problema. A tecnologia vem depois.") entra como postura,
nunca como slogan colado no e-mail.

## Regras de forma

| Regra              | Valor                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tamanho do corpo   | 50–120 palavras (lint: erro acima de 140, aviso fora de 30–120)                                                                                                 |
| Ideias por e-mail  | 1 — uma cena de dor específica da indústria, nada de lista de serviços                                                                                          |
| Perguntas          | exatamente 1, curta, respondível numa linha ("faz sentido aí?")                                                                                                 |
| Adjetivos de venda | zero ("inovador", "líder", "exclusivo" — o lint bloqueia, PRD §6)                                                                                               |
| Assunto            | minúsculo, curto (≤ 60 caracteres), específico — ex.: `pedidos em planilha na {{empresa}}?`                                                                     |
| Links              | primeiro e segundo toques SEM link; link só no E3, com UTM (ver abaixo)                                                                                         |
| Formato            | texto puro; sem HTML, sem imagem, sem negrito, sem emoji                                                                                                        |
| Exclamações        | no máximo 1 na peça inteira (ideal: 0)                                                                                                                          |
| Assinatura         | NÃO escreva no corpo — o motor anexa a assinatura oficial (Luigi Choffe, Sócio fundador, logo, WhatsApp, CNPJ) de `src/lib/outbound/signature.ts` em todo envio |
| Opt-out humano     | no E4 (ou antes, se couber): "se não fizer sentido, me diz que eu paro por aqui"                                                                                |

A identificação legal (razão social/CNPJ, PRD §18) é acrescentada pelo motor de envio na hora do
disparo — não faz parte da copy versionada (e hoje ainda está pendente, decisão §24).

## A sequência (PRD §7)

| Passo | offsetDays | Ângulo                                                                     | Link? |
| ----- | ---------- | -------------------------------------------------------------------------- | ----- |
| e1    | 0          | Cena de dor da indústria + pergunta curta (gancho da oferta âncora)        | não   |
| e2    | 3          | "Você não precisa saber o que construir" — diagnóstico, remoção de objeção | não   |
| e3    | 7          | Prova: dado de mercado com fonte OU simulação rotulada (`withLink: true`)  | sim   |
| e4    | 7          | Encerramento curto e educado + opt-out humano                              | não   |

Cada follow-up agrega ângulo novo. Nunca "só passando para lembrar". Sem breakup passivo-agressivo.

Link do E3 (único link permitido, utm_campaign é o slug da campanha, escrito à mão — sem variável):

```
https://www.dreamy.app.br/solucoes/<pagina-da-solucao>?solucao=<ancora>&utm_source=outbound&utm_medium=email&utm_campaign=<slug-da-campanha>&utm_content=e3
```

Páginas por âncora: `nova-receita` → `/solucoes/nova-receita-digital` · `sistema` → `/solucoes/sistemas-sob-medida` · `agente-ia` → `/solucoes/agentes-de-ia`.

## O que o lint bloqueia (espelho de `render.ts` — erro = não envia)

1. **Claims proibidos de posicionamento (PRD §3)**: NoCode/LowCode, Bubble, chatbot, MVP,
   landing page, e-commerce, consultoria gratuita. Vale até em negação: "não é chatbot" também
   é bloqueado — descreva o que o agente FAZ ("robô de conversa" é a alternativa aceita).
2. **Vocabulário de e-mail marketing**: imperdível, não perca, oferta especial, promoção,
   desconto, grátis/gratuito, garantido/garantia de, líder de mercado, melhor do mercado,
   solução inovadora/inovador, revolucionário, disruptivo, alavancar, sinergia, clique aqui,
   acesse já, última chance, exclusivo para você.
3. **Frases-carimbo de IA/mala direta**: espero que este e-mail…, espero que esteja bem,
   meu nome é, venho por meio deste, estou entrando em contato, gostaria de (me) apresentar,
   no cenário atual, no mundo de hoje, nos dias de hoje, cada vez mais, nesse sentido,
   além disso, vale ressaltar, é importante destacar, não hesite em, fico/estou à disposição para,
   aguardo seu retorno, atenciosamente, cordialmente, prezado(a). O teste é sempre:
   uma pessoa ocupada escreveria isso num e-mail curto?
4. **Número sem fonte nem rótulo**: qualquer percentual, R$, US$ ou multiplicador ("3x") sem
   citação de fonte (McKinsey/Stanford/IDC) nem rótulo de exemplo/simulação.
5. **Forma**: mais de 140 palavras; HTML no corpo; mais de 1 exclamação; emoji no assunto;
   palavra em CAIXA ALTA no assunto. Aviso (pede revisão): mais de um travessão — um já é muito.

## Regra de prova (PRD §3 e §6)

Nenhum claim próprio da Dreamy está aprovado. São proibidos: métricas próprias, nomes de clientes,
cases, logos e depoimentos — nada disso está aprovado em `docs/CONTENT-SOURCES.md` (regra do PRD §3). O que PODE entrar:

- **Só estes 3 dados de mercado, sempre com a fonte no corpo do e-mail**:
  1. 88% das empresas já usam IA em ao menos uma função, ante 78% um ano antes (McKinsey, State of AI 2025);
  2. US$ 252 bi investidos em IA em 2024, +44% (Stanford AI Index 2025);
  3. retorno médio de 3,7× por US$ 1 investido em IA generativa (IDC/Microsoft, 2024).
- **OU a simulação de receita, sempre rotulada** ("exemplo", "não é promessa"): mecânica
  `clientes × ticket × 70% de adesão` (decisão do Luigi em 2026-09-10: 30% soava baixo demais) + custo de inação ("cada mês sem o produto no ar…").
  Só em campanhas com âncora Nova Receita Digital, com números redondos declarados como exemplo.
- No máximo UM bloco de prova por sequência inteira (no E3). E1, E2 e E4 não carregam número nenhum.

## Regra de personalização

- Variáveis disponíveis: `{{nome}}`, `{{sobrenome}}`, `{{cargo}}`, `{{empresa}}`, `{{industria}}`
  - colunas extras do Clay (viram variáveis pelo `custom` do contato). Variável faltando = envio
    barrado (`buildEmail` lança) — nunca sai e-mail com buraco.
- **Personalização de contexto vale mais que personalização de campo.** Uma cena que só faz
  sentido para aquela indústria personaliza mais que dez `{{nome}}`. Use `{{nome}}` uma vez
  (abertura), `{{empresa}}` uma ou duas vezes, `{{cargo}}` quase nunca (só se mudar a frase).
- **`{{abertura}}` (Clay)**: quando a lista vier com coluna de abertura personalizada por
  contato (ex.: gancho do LinkedIn/site da empresa), essa variável é a PRIMEIRA linha do E1 —
  acima de qualquer template. No import, mapeie a coluna do Clay para `abertura` em
  `scripts/outbound/import-map.ts`; campanhas que usam `{{abertura}}` só rodam com a coluna presente.

## RUIM → BOM (3 pares reais)

**Par 1 — abertura.** RUIM (mala direta; o lint pega 4 frases-carimbo):

> Prezado João, espero que este e-mail o encontre bem. Meu nome é Rafael e estou entrando em
> contato para apresentar a Dreamy, empresa especializada em transformação digital que pode
> revolucionar os resultados da sua empresa!

BOM (cena reconhecível + pergunta):

> João, uma cena que aparece muito em distribuidoras: o ERP diz uma coisa, o vendedor vê outra,
> e no meio existe uma planilha que só uma pessoa entende. Acontece aí na Acme também?

**Par 2 — prova.** RUIM (métrica própria inventada + promessa — PRD §3 proíbe):

> Nossos clientes aumentam o faturamento em até 40% nos primeiros 3 meses. Resultado garantido
> ou seu dinheiro de volta. Agende hoje uma demonstração!

BOM (dado de terceiro, fonte no corpo, pergunta devolvida ao leitor):

> Um dado de mercado, com a fonte junto: 88% das empresas já usam IA em pelo menos uma função
> (McKinsey, State of AI 2025). A pergunta que interessa não é "se", é "onde" — no seu processo.

**Par 3 — follow-up.** RUIM (lembrete vazio + CTA de campanha):

> Só passando para lembrar do meu e-mail anterior! Clique aqui para agendar uma conversa com
> nossos especialistas. Fico à disposição para qualquer esclarecimento. Atenciosamente, Equipe Dreamy

BOM (ângulo novo + opt-out humano):

> Encerro por aqui. Fica a pergunta: qual processo da Acme valeria a pena tirar da planilha este
> ano? Se um dia fizer sentido, é só responder. Se não fizer, me diz que eu paro por aqui.

## Checklist antes de marcar `status: "ready"`

- [ ] Leu em voz alta e soa como e-mail que você mandaria de verdade?
- [ ] 1 cena de dor da indústria (não genérica), 1 pergunta, 0 adjetivos de venda?
- [ ] `pnpm test -- outbound-campaigns` verde (lint zero erros, tamanhos, offsets, links)?
- [ ] Número só no E3, com fonte ou rótulo de exemplo? E1/E2/E4 sem link e sem número?
- [ ] `industria` bate com o valor normalizado da coluna indústria da lista importada?
- [ ] `utm_campaign` do E3 = slug da campanha (hardcoded)?
- [ ] Aprovação do usuário registrada via `pnpm outbound:campaign approve` antes de qualquer envio (PRD §20)?
