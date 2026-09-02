# Aquário VIVO — o fator WOW dos agentes de IA

> Pedido do Luigi (2026-08-31): "quero algo com movimento, que eles interajam entre si,
> que tenham uma inteligência quase humana. Faça um plano para que essa etapa seja um
> fator WOW. Use a melhor biblioteca de design que você puder."
> Referência visual: diagrama hub-and-spoke (Entrada de dados → Raciocínio → Ações
> automatizadas) com um agente central e fluxo entre cartões.

## A tese

O time do MORK já é real: demandas reais, disparos reais, prestação de contas real.
O que falta é **presença**. O WOW não vem de enfeite — vem de ver uma equipe de IA
que respira, conversa entre si e fala com você em primeira pessoa, sempre ancorada
em dados verdadeiros. A regra de honestidade do Aquário continua absoluta:
**luz forte = trabalho real; vida ambiente = luz suave e nunca mente**.

A assinatura da entrega (o único lugar onde gastamos ousadia): **as conversas** —
dois agentes se acendem, partículas viajam pela sinapse nos dois sentidos e balões
de vidro mostram micro-falas verdadeiras (a última ação registrada de cada um, ou
uma descrição fiel do que a cadeira observa quando ociosa).

## Biblioteca

**Motion (Framer Motion v12, pacote `motion`)** — o padrão-ouro de animação em React:
física de molas de verdade, `AnimatePresence` para entrada/saída, contadores com
`useSpring`, tree-shaking via `motion/react`. Compatível com React 19 + Next 16.
O canvas da rede continua motor próprio (rAF); Motion cuida da camada HTML
(balões, contadores, revelações). CSS cuida do que CSS faz melhor (deriva, respiração).

## Plano

| #    | Item                               | O que muda                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Status             |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| P0.1 | **Motor de conversas** (canvas v4) | Coreógrafo ambiente: a cada ~10s um par colaborador conversa — partículas direcionais com rastro indo e voltando pela sinapse, link ganha brilho suave temporário. Delegação: MORK emite rajada de pulso para agentes com demanda ativa. Pausa com aba oculta e fora da viewport.                                                                                                                                                                                                                                                           | feito · 2026-08-31 |
| P0.2 | **Balões de fala** (Motion)        | Durante a conversa, balões de vidro surgem sobre os dois agentes (mola, entrada/saída via AnimatePresence) com micro-falas VERDADEIRAS: última ação registrada do ator ou fala idle fiel ao cargo. Camada 100% decorativa (`aria-hidden`).                                                                                                                                                                                                                                                                                                  | feito · 2026-08-31 |
| P1.1 | **Corpo vivo** (CSS)               | Deriva orgânica por nó (flutuação lenta, fase própria por cadeira), respiração sutil de escala, "piscada" do dot de status, anel orbital tracejado girando no MORK (o maestro). Tudo `motion-safe`.                                                                                                                                                                                                                                                                                                                                         | feito · 2026-08-31 |
| P1.2 | **Ficha com mola**                 | A ficha central entra com overshoot (escala 0.96 → 1 com curva de mola em CSS), como se o agente virasse para você.                                                                                                                                                                                                                                                                                                                                                                                                                         | feito · 2026-08-31 |
| P2   | **Primeira pessoa**                | `seatStatus` fala como gente: "Estou na demanda …", "Acabei de entregar …", "Estou disponível; abra uma demanda…". Fichas e chat herdam a voz. Testes atualizados.                                                                                                                                                                                                                                                                                                                                                                          | feito · 2026-08-31 |
| P3   | **O palco da aba MORK**            | Tradução do diagrama de referência com dados REAIS: Entrada de dados (contatos na base, respostas recebidas) → Raciocínio (a lente do Aquário no centro) → Ações (e-mails enviados, reuniões, tarefas concluídas). Cartões de vidro conectados por dutos com fluxo animado; números contam de zero com mola ao entrar na tela. Empilha no mobile.                                                                                                                                                                                           | feito · 2026-08-31 |
| P4   | **QA de vida**                     | `prefers-reduced-motion` = tudo estático (um quadro); axe AA verde; espelho com hover em 1536 e 1720; gate completo + 80 e2e.                                                                                                                                                                                                                                                                                                                                                                                                               | feito · 2026-08-31 |
| P5   | **Gestão do time (BI)**            | A aba MORK vira a central de gerenciamento dos agentes: cartão de gestão por cadeira (Agora em 1ª pessoa, barra de fluxo fila→andamento→entregue, entregas recentes, "atende" e entrega média em horas; a vaga vira convite) + BI da operação (barras por cadeira com legenda e rampa sequencial da casa; ritmo diário com hoje em verde). Motor puro e testado em `team-bi.ts` (atribuição por especialidade da fila — mesmo mapa de kinds do Aquário); método da skill dataviz (forma antes de cor, encoding secundário sempre, um eixo). | feito · 2026-09-02 |

## O que fica de fora (de propósito)

- **Som** — console de trabalho, silêncio é respeito.
- **Falas inventadas** ("fechei 3 negócios!") — a regra anti-enfeite-mentiroso veta;
  balões só citam o registro real ou descrevem a função em modo vigília.
- **Avatares 3D/Lottie de robôs** — o material da casa é vidro fosco + verde Dreamy;
  um mascote genérico quebraria a identidade.
