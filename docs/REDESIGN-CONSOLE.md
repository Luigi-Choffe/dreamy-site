| feito · 2026-09-01 || feito · 2026-09-01 || feito · 2026-09-01 |# Redesign do console — o contrato de perfumaria

> Pedido do Luigi (2026-09-01): "achei feito com pouco esmero; valorizo muito o
> trabalho de perfumaria e detalhe. Tem coisa cortando, tabela mal formatada,
> espaçamento ruim. Primeiro desenhamos como cada tela deve ser; depois, em
> diversas solicitações, executamos os itens separadamente."
>
> Método: auditoria com espelho de página INTEIRA de 13 telas (demo, 1720px) +
> calibração pela skill `ui-ux-pro-max` (`--design-system`, density 8/motion 4).
> Execução: **um pedido = um lote**, cada lote com espelho antes/depois, gate
> completo e e2e. Status por item, como em `docs/MELHORIAS-CONSOLE.md`.

## Direção validada (o que NÃO muda)

A skill confirmou **Liquid Glass** como o estilo certo para console Apple-like
(riscos que ela lista já são tratados: contraste 4.5:1, foco visível, reduced
motion, fallback de transparência). A paleta e as fontes genéricas que o motor
sugeriu (preto+dourado, Cormorant) foram **descartadas de propósito**: a
identidade é a da Dreamy — vidro fosco claro, verde #46eb7e só onde há vida ou
ação, tokens de `src/styles/tokens.css`. O aviso que a skill deu e que vira lei
aqui: **evitar "cheap visuals + fast animations"** — nada de efeito barato.

## As leis da perfumaria (valem para TODA tela)

1. **Nada corta**: texto nunca some por overflow sem `title`; nome nunca quebra
   deixando número órfão; largura mínima antes de truncar.
2. **Tabela é grade**: coluna numérica alinha à direita com `tabular-nums`;
   célula de identidade tem largura mínima; datas curtas (`dd/mm hh:mm`) com o
   completo no `title`; zebra sutil; ação destrutiva NUNCA em carpete (menu ⋯
   por linha, vermelho só no hover/confirmação).
3. **Ação parece ação**: todo clicável tem affordance (pill/hover/cursor);
   texto que executa algo não pode parecer texto.
4. **Zeros são mudos**: contadores zerados esmaecem ou somem; plural correto
   ("2 tarefas", nunca "2 tarefa(s)").
5. **Título antes de chip**: a linha começa pelo que importa; chips de status
   vêm depois, numa paleta única de tons.
6. **Vazio tem direção**: estado vazio convida à ação em uma frase; dias/blocos
   vazios colapsam em vez de empilhar cartões ocos.
7. **Régua densa e constante**: espaçamento de dashboard (8/12/16/24/32px);
   mesma distância entre seções em toda aba; sem vãos gigantes nem apertos.
8. **Movimento com motivo**: entrada dos cartões com stagger sutil (Motion, já
   instalada; 300–450ms, mola), nunca decorativo; reduced-motion = estático.

## Lotes transversais (fazem o console inteiro de uma vez)

| #   | Lote               | O que entrega                                                                                                                                                        | Status                                                             |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| T1  | **Régua e grid**   | Tokens de espaçamento do console (densidade dashboard) aplicados na casca e nas seções; mesma cadência vertical em toda aba; título de seção com contagem esmaecida. | feito · 2026-09-01                                                 |
| T2  | **Tabela da casa** | Componente/anatomia padrão de tabela (leis 1–2) e migração das tabelas de Contatos, Atividade, Supressão e Campanha para ele.                                        | feito · 2026-09-01 (todas as tabelas migradas)                     |
| T3  | **Linha de lista** | Anatomia padrão de linha (identidade · contexto · ações; ações secundárias no hover + sempre via teclado) para Hoje, Respostas, Demandas e Agenda.                   | estreou · 2026-09-01 (Respostas; Hoje/Demandas/Agenda em R1/R7/R2) |
| T4  | **Chips e datas**  | Paleta única de chips de status; formatadores `dd/mm hh:mm` + `title`; plurais corretos; zeros mudos em todo o console.                                              | feito · 2026-09-01                                                 |
| T5  | **Entrada viva**   | Stagger de entrada dos cartões por aba (Motion, mola, reduced-motion ok), consistente com o Aquário.                                                                 | a fazer                                                            |

## Tela a tela (defeitos observados → desenho alvo)

| #   | Tela                   | Hoje (do espelho)                                                                                                                                                                                  | Desenho alvo                                                                                                                                                                                                                         | Status             |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| R1  | **Hoje**               | Ações "+1d (02/09) · +3d (04/09) · semana (08/09)" parecem texto solto e se repetem idênticas em toda linha; colunas da linha não se ancoram.                                                      | Linha em 3 zonas com grid fixo; "Concluir" como ação primária e **um** menu compacto "adiar ▾" (datas dentro); data da tarefa alinhada em coluna própria.                                                                            | feito · 2026-09-01 |
| R2  | **Agenda**             | 6 cartões "Dia livre na cadência" empilhados = página oca; "0 e-mail(s) · 0 tarefa(s) · 0 reunião(ões)" repetido em TODO cartão; plurais mecânicos.                                                | Hoje é o cartão-herói; dias com conteúdo ganham cartão; **dias livres consecutivos colapsam numa faixa única** ("02/09 a 10/09 · 5 dias livres"); contador só mostra o que existe; plurais de verdade.                               | feito · 2026-09-01 |
| R3  | **Respostas**          | Toda linha carrega select+Salvar (12 formulários idênticos gritando); nome termina em "·" órfão antes da empresa; colunas alinham só na 1ª linha; "Sugestão de IA" repetido 12×; data comprida.    | Classe vira **chip colorido**; editar aparece no hover/menu da linha (e por teclado); identidade "Nome · Empresa" sem separador órfão; nota e sugestão de IA na zona de contexto; colunas ancoradas; datas curtas.                   | feito · 2026-09-01 |
| R4  | **Contatos**           | Nome quebra com o número órfão na 2ª linha ("Gabriela Demo 07 / · Empresa Demo 07"); 60 botões vermelhos "Suprimir" em carpete; slug de campanha quebra em 2 linhas; último envio verboso.         | Coluna de identidade com `min-w` + truncate com title (nunca quebra número); Suprimir vai para menu ⋯ da linha (vermelho só na confirmação); campanha ativa vira chip curto; "entregue · 28/08 09:50".                               | feito · 2026-09-01 |
| R5  | **Conta do contato**   | Timeline e blocos com cadência de espaçamento irregular entre seções; formulários de nota/tarefa com larguras soltas.                                                                              | Mesma régua T1; timeline com ícone por tipo de evento e agrupamento por dia; formulários alinhados à coluna.                                                                                                                         | a fazer            |
| R6  | **Pipeline**           | Base forte (drag and drop, otimismo). Perfumaria: cabeçalhos de raia, sombra dos cards, faixa de valor por coluna.                                                                                 | Cabeçalho de coluna com total R$ alinhado; card com hierarquia empresa→valor→idade; drop target mais evidente; scrollbar fina.                                                                                                       | a fazer            |
| R7  | **Demandas**           | 5 seções h2 minúsculas ("pendente (1)") com UM cartão cada = página picotada; chips ANTES do título enterram o assunto; metadado comprido.                                                         | **Fila única** agrupada por estado (aberta primeiro), título na frente, chips depois; metadado "por X · 01/09 09:05"; form "Nova demanda" equilibrado com a fila; encerrar/recusar no menu da linha.                                 | feito · 2026-09-01 |
| R8  | **Atividade**          | Funciona, mas linhas uniformes demais: tipo do evento não tem cor/ícone, escaneabilidade baixa em 200 linhas.                                                                                      | Ícone/cor discreta por tipo (envio, resposta, crm, sistema); cabeçalho de dia grudento (sticky); régua T1.                                                                                                                           | a fazer            |
| R9  | **Supressão**          | Sólida após a rodada anterior; falta a anatomia T2 (números à direita, menu ⋯) e o vazio com direção.                                                                                              | Migração para a tabela da casa; buscar/limite mantidos.                                                                                                                                                                              | a fazer            |
| R10 | **Campanha (detalhe)** | A tela mais velha do console: h1 é o slug ("exemplo"), chips de estado com tons mistos, URL inteira do E3 correndo solta na prévia, tabela de atividades com 50 linhas sem agrupamento nem limite. | Header digno (nome da campanha + âncora + estado em chips da paleta); prévia com link encurtado visual (rótulo + title); atividades agrupadas por dia com "Mostrar mais"; funil por passo com rótulos maiores e asterisco explicado. | feito · 2026-09-01 |
| R11 | **Configuração**       | Cartão estreito num vão vazio de 60% da largura; labels vazam slug interno ("Título (nova-receita)").                                                                                              | Grid de 3 cartões de oferta lado a lado (accent sutil por âncora) + cartão de marca; labels humanas ("Oferta · Nova Receita Digital"); rodapé honesto mantido.                                                                       | feito · 2026-09-01 |
| R12 | **Visão geral**        | Refinada recentemente; sobras: alturas dos cards de campanha vs. rascunhos, hairlines duplicadas em telas médias.                                                                                  | Passe fino de régua e alinhamento; nada estrutural.                                                                                                                                                                                  | a fazer            |
| R13 | **MORK (palco)**       | Recém-entregue (Aquário VIVO). Sobras: cartões do fluxo em lg intermediário, dutos sumindo abaixo de lg sem substituto.                                                                            | Indicador de fluxo vertical no empilhado (setas discretas); régua T1 no diário.                                                                                                                                                      | a fazer            |
| R14 | **Login e erro**       | Cena boa; conferir régua, foco e microcopy.                                                                                                                                                        | Passe fino apenas.                                                                                                                                                                                                                   | a fazer            |

## Ordem recomendada de execução (um pedido por linha)

1. **T1+T4** (régua, chips, datas, plurais, zeros) — o "esmero" transversal que
   muda a percepção do console inteiro de uma vez.
2. **T2+R4** (tabela da casa estreando em Contatos) — a pior tabela hoje.
3. **T3+R3** (linha da casa estreando em Respostas) — o formulário repetido 12×.
4. **R2+R1** (Agenda colapsando vazios + Hoje com menu de adiar).
5. **R7** (Demandas em fila única).
6. **R10** (Campanha, a tela mais velha).
7. **R11** (Configuração em grid de ofertas).
8. **T5** (entrada viva) — por último, para animar o layout já correto.
9. **R5, R6, R8, R9, R12, R13, R14** (passes finos, podem agrupar 2–3 por pedido).

## O que cada lote entrega (critério de pronto)

- Espelho antes/depois em 1720 e 1536 (e mobile quando a tela muda de layout).
- Leis da perfumaria conferidas na tela tocada (checklist acima).
- `pnpm check` + 80 e2e verdes; axe AA sem regressão; commit + CI verde.
- Status atualizado NESTA tabela no mesmo commit.
