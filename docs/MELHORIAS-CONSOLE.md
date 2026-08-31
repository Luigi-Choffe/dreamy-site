# Melhorias do Console — levantamento e plano de execução

Criado em 2026-08-31 a pedido do Luigi, após defeito visível em produção (fichas do
Aquário cortadas). Este documento é o contrato de qualidade do CRM piloto: tudo
listado aqui será feito, na ordem das prioridades, e cada item ganha o commit ao
lado quando concluído.

## Por que ficou ruim (diagnóstico honesto)

O console cresceu em ritmo de guerra (CRM, Aquário, kanban, chat e design pass em
48 horas). Cada peça nasceu verificada, mas **as integrações entre peças novas**
não: o chat lateral deu rolagem própria à coluna direita, e rolagem interna corta
qualquer elemento que abra para fora dela — as fichas do Aquário, que abrem para
a esquerda, passaram a ser decapitadas. O espelho de QA cobria cada tela isolada,
não o hover das fichas depois da mudança do chat.

**Processo novo a partir de agora**: toda mudança na coluna lateral ou em
elementos flutuantes exige espelho com hover/foco aberto, em 1536px (menor tela
com a coluna) e 1720px.

## P0 — defeitos visíveis (fazer AGORA)

| #   | Item                                                                                                                    | Correção                                                                                                                                                         | Status             |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | **Fichas do Aquário cortadas** pela rolagem interna da coluna                                                           | Ficha deixa de abrir para fora do nó: vira um painel central de vidro DENTRO da lente (CSS `:has`, hover e foco), imune a qualquer clipping, em qualquer largura | feito · 2026-08-31 |
| 2   | **Rolagem interna da coluna é invisível** (scrollbar oculta): ninguém descobre o chat abaixo do Aquário em telas baixas | Indicador de continuação (fade no pé da coluna) e scrollbar fina visível ao pairar                                                                               | feito · 2026-08-31 |

## P1 — usabilidade que falta (auditorias de 2026-08-30, ainda abertas)

| #   | Item                                                                                    | Correção                                                                                                                 | Status             |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 3   | Atividade corta em 200 eventos sem paginação nem busca                                  | "Mostrar mais" (mesmo padrão de Contatos) + busca por contato + filtro de período                                        | feito · 2026-08-31 |
| 4   | Supressão sem busca ("este e-mail está suprimido?" exige varrer tooltips)               | Busca no servidor contra o e-mail completo (exibição continua mascarada) + filtro por motivo                             | feito · 2026-08-31 |
| 5   | Erro de formulário derruba a página inteira (error boundary) e perde o que foi digitado | `useActionState` nos forms multi-campo (configuração, nova demanda, registrar resposta): erro inline, campos preservados | feito · 2026-08-31 |
| 6   | Registrar resposta: select nativo com até 200 contatos sem busca                        | Combobox leve (input filtra as opções, mesmo name no submit)                                                             | feito · 2026-08-31 |
| 7   | Ações de escrita sem feedback de sucesso (a página só recarrega)                        | Toast de confirmação nos forms do console (nota salva, demanda criada, resposta registrada)                              | feito · 2026-08-31 |
| 8   | Sincronizar pipeline não mostra resultado                                               | Linha de status pós-ação ("2 criados, 1 avançado" ou "nada novo")                                                        | feito · 2026-08-31 |
| 9   | Sem atalhos de teclado                                                                  | `/` foca a busca da página; atalhos de navegação entre abas                                                              | feito · 2026-08-31 |

## P2 — polimento (depois dos P1)

| #   | Item                                                                                                          | Status     |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| 10  | Toast/Dialog herdarem o material de vidro dentro do console (hoje ficam com o material do site)               | aberto     |
| 11  | Sparkline de envios com marcador de "hoje" e valor no hover                                                   | aberto     |
| 12  | Revisão completa do console em 390px (mobile) e 768px                                                         | aberto     |
| 13  | Ordenação e "Mostrar mais" também nas tabelas de Respostas e Supressão                                        | aberto     |
| 14  | Ideia a discutir: seleção múltipla em Contatos para suprimir em lote (perigosa; exige desenho de confirmação) | a discutir |

## Regras que continuam valendo

Motor de envio intocado; PII nunca em texto visível nem em prompt de IA; verde da
marca em toques (ação principal, conversão, vida real); travessão proibido;
fallbacks de acessibilidade (reduced motion/transparency, teclado) em tudo; gate
completo + e2e + espelho antes de cada push.
