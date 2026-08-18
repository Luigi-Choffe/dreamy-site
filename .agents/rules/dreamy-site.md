---
trigger: always_on
description: Regras permanentes do projeto do site institucional B2B da Dreamy.
---

# Regra do workspace — Dreamy Site

Este projeto implementa o site institucional B2B da Dreamy.

O arquivo `docs/PRD.md` é a fonte de verdade. Em caso de conflito, seguir a ordem de prioridade do PRD:
posicionamento e estratégia comercial → regras de negócio → arquitetura de informação → UX → copy → design system → implementação técnica.

## Regras inegociáveis

- Nunca invente clientes, métricas, depoimentos, cases ou resultados. Todo dado comercial precisa de origem verificável registrada em `docs/CONTENT-SOURCES.md` e aprovação explícita antes de entrar no código.
- Nunca reintroduza NoCode/LowCode (ou ferramentas como Bubble) como posicionamento público. Tecnologia é meio, resultado é mensagem.
- Existem exatamente três soluções comerciais principais: Nova Receita Digital, Sistemas Sob Medida e Agentes de IA. Não criar uma quarta oferta, catálogo de serviços, landing pages, branding, e-commerce, MVP ou treinamento como produto.
- Não usar depoimentos/testemunhos (nem campo de testimonial no modelo de conteúdo), consultoria gratuita, logos sem autorização, imagens genéricas de robôs/cérebros digitais.
- Não publicar placeholders, lorem ipsum ou conteúdo marcado como pendente. Cases com `approved: false` e insights com `status: draft` nunca entram no build público. Seções orientadas a dados (prova, cases, insights) só aparecem quando existir conteúdo aprovado.
- Antes de adicionar dependência, avalie se existe solução nativa (Next.js, CSS, plataforma). Documente a decisão em `docs/DECISIONS.md` (ADR).
- Server Components são o padrão. Client Components somente para formulário, animação, interação, estado local ou APIs do navegador.
- Preserve acessibilidade (WCAG 2.2 AA), SEO (um H1 por página, metadata, structured data válido) e performance (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1; Lighthouse mobile ≥ 90/95/95/95).
- Nunca envie PII (nome, e-mail, telefone, texto do problema) para GA4, Meta ou LinkedIn. Eventos e parâmetros permitidos estão em `docs/TRACKING.md`.
- Nunca commite secrets. Apenas nomes de variáveis em `.env.example`.
- Copy de marketing fica em `src/content/` e `src/config/`, nunca hard-coded dentro de componentes reutilizáveis (preparação para i18n futura).
- Lead scoring é server-side, configurável em um único lugar (`src/lib/leads/scoring.ts`) e nunca exibido ao visitante.

## Processo

- Toda alteração visual relevante deve ser testada em desktop e mobile (390 px, 768 px, 1440 px no mínimo).
- Não considere uma fase concluída sem `pnpm build`, `pnpm lint`, `pnpm typecheck`, testes relevantes e revisão no browser (screenshots em `docs/qa/`).
- Ao finalizar cada grande etapa, produzir resumo: o que foi implementado, arquivos alterados, testes realizados, pendências, screenshots mobile e desktop.
- Não iniciar grandes mudanças sem plano. Preferir Planning Mode.

## Referências

- PRD: `docs/PRD.md`
- Plano: `docs/IMPLEMENTATION-PLAN.md`
- Arquitetura: `docs/ARCHITECTURE.md`
- Decisões: `docs/DECISIONS.md`
- Fontes de conteúdo: `docs/CONTENT-SOURCES.md`
- Tracking: `docs/TRACKING.md`
- QA: `docs/QA.md`
- Migração SEO: `docs/SEO-MIGRATION.md`
