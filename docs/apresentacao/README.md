# Apresentação institucional

- **`Dreamy — Apresentação Institucional (editável).pptx`** — versão NATIVA do pitch: textos, formas e diagramas editáveis no PowerPoint, animações de entrada (fade escalonado) e transições suaves, fala completa nas notas do apresentador, fontes da marca **embutidas** no arquivo (abre com a identidade correta em qualquer máquina). Gerada por `scripts/dev/build-deck-native.py` (dirige o PowerPoint via COM — requer Windows + PowerPoint + `pip install pywin32`; as WOFFs de `src/assets/fonts/` são convertidas para TTF e instaladas por usuário para o build).
- **`Dreamy — Apresentação Institucional.pptx`** — versão PowerPoint do pitch: os 12 slides em alta resolução (2560×1440, identidade preservada mesmo sem as fontes da marca instaladas) + **fala completa nas notas do apresentador** (objetivo + tempo + roteiro por slide; visão do apresentador: `Alt+F5`). Slides são imagens — para editar o conteúdo, altere o HTML e regenere (abaixo).
- **`ROTEIRO.md`** — o mesmo roteiro de fala em texto corrido, para ensaio (≈ 9 min; substituir `[seu nome]`, respeitar as pausas marcadas).
- **`Dreamy — Apresentação Institucional.pdf`** — pitch de palco, 12 slides 16:9, uma ideia por slide (capa com o sistema vivo, problema, virada "É nesse ponto que entramos", diagnóstico, as três soluções, um slide visual por produto — curva conceitual de receita marcada "Ilustrativo", convergência dados→decisão, hub do agente —, onde os agentes atuam, como trabalhamos, para quem, fechamento com contato). Copy fiel ao PRD/site (apenas cortes/rearranjos); sem métricas, clientes ou depoimentos (regra do PRD §2). O detalhe é fala do apresentador — para material de envio, use o site.
- **`dreamy-apresentacao.html`** — fonte da apresentação (mesmos tokens/fontes da marca; discos do símbolo como motivo, ADR-018; assinatura: barra de progresso estilo player no rodapé). Edite aqui e regenere o PDF:

```bash
pnpm tsx scripts/dev/html-to-pdf.ts docs/apresentacao/dreamy-apresentacao.html "docs/apresentacao/Dreamy — Apresentação Institucional.pdf"
# PPTX: renderizar slides em 2x e montar com notas (roteiro fica no script)
pnpm tsx scripts/dev/deck-shots.ts docs/apresentacao/dreamy-apresentacao.html <pasta-shots> 2
python scripts/dev/build-deck-pptx.py <pasta-shots>
```

O HTML também abre direto no browser (visualização slide a slide) e imprime corretamente (Ctrl+P → PDF). Contatos exibidos: site + WhatsApp comercial (`src/config/site.ts` — confirmar antes de usar externamente, ADR-013).
