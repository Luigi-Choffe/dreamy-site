# Apresentação institucional

- **`Dreamy — Apresentação Institucional.pdf`** — 13 slides 16:9 (capa, problema, quem somos, diagnóstico, as três soluções, um slide por produto + casos de uso de agentes, como trabalhamos, para quem, princípios, fechamento com contato). Copy fiel ao PRD/site; sem métricas, clientes ou depoimentos (regra do PRD §2).
- **`dreamy-apresentacao.html`** — fonte da apresentação (mesmos tokens/fontes da marca; discos do símbolo como motivo, ADR-018). Edite aqui e regenere o PDF:

```bash
pnpm tsx scripts/dev/html-to-pdf.ts docs/apresentacao/dreamy-apresentacao.html "docs/apresentacao/Dreamy — Apresentação Institucional.pdf"
```

O HTML também abre direto no browser (visualização slide a slide) e imprime corretamente (Ctrl+P → PDF). Contatos exibidos: site + WhatsApp comercial (`src/config/site.ts` — confirmar antes de usar externamente, ADR-013).
