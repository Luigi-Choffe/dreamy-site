# Apresentação institucional

- **`Dreamy — Apresentação Institucional.pdf`** — pitch de palco, 12 slides 16:9, uma ideia por slide (capa com o sistema vivo, problema, virada "É nesse ponto que entramos", diagnóstico, as três soluções, um slide visual por produto — curva conceitual de receita marcada "Ilustrativo", convergência dados→decisão, hub do agente —, onde os agentes atuam, como trabalhamos, para quem, fechamento com contato). Copy fiel ao PRD/site (apenas cortes/rearranjos); sem métricas, clientes ou depoimentos (regra do PRD §2). O detalhe é fala do apresentador — para material de envio, use o site.
- **`dreamy-apresentacao.html`** — fonte da apresentação (mesmos tokens/fontes da marca; discos do símbolo como motivo, ADR-018; assinatura: barra de progresso estilo player no rodapé). Edite aqui e regenere o PDF:

```bash
pnpm tsx scripts/dev/html-to-pdf.ts docs/apresentacao/dreamy-apresentacao.html "docs/apresentacao/Dreamy — Apresentação Institucional.pdf"
```

O HTML também abre direto no browser (visualização slide a slide) e imprime corretamente (Ctrl+P → PDF). Contatos exibidos: site + WhatsApp comercial (`src/config/site.ts` — confirmar antes de usar externamente, ADR-013).
