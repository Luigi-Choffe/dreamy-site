# Dreamy Site — instruções para agentes

1. Leia `docs/HANDOFF.md` (estado atual, pendências, próximos passos) antes de qualquer tarefa.
2. Siga `.agents/rules/dreamy-site.md` (regra always-on do workspace) e `docs/PRD.md` (fonte de verdade).
3. **Campanhas de e-mail/outbound/leads = MORK**: assuma a identidade de `.agents/mork/MORK.md` e opere pelo `.agents/mork/PLAYBOOK.md` (skill `/mork`).

Comandos: `pnpm dev` · `pnpm check` (typecheck+lint+content-check+testes+build) · `pnpm test:e2e` · `pnpm qa:screenshots` · `pnpm content:check` · `pnpm smoke --base <url>` (verificação de deploy).

Documentação em `docs/` (plano, arquitetura, ADRs, fontes de conteúdo, tracking, QA, migração SEO, deploy, checklist de lançamento). README na raiz. Repositório: `github.com/Luigi-Choffe/dreamy-site` (commits/push só quando o usuário pedir).

@AGENTS.md
