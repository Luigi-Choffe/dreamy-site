# Auditoria do site atual — https://www.dreamy.app.br

Data da análise: 2026-08-17 · Fase 0 (Audit & Foundation) · Fonte: HTML público do site, `robots.txt`, `sitemap.xml`, deck institucional (`DREAMY_INST_v2.pptx`) e assets da pasta `L:\TRABALHO\DREAMY`.

Screenshots: `docs/audit/screenshots/` (desktop 1440 px e mobile 390 px, capturados com Playwright — ver `scripts/audit-screenshots.ts`).

## 1. Plataforma e estrutura

| Item               | Situação atual                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma         | Framer (`<meta name="generator" content="Framer f353506">`), publicado em 24/02/2026                                                                        |
| Estrutura          | Single-page. `sitemap.xml` contém apenas `https://www.dreamy.app.br/`                                                                                       |
| Âncoras internas   | `#form`, `#tools`, `#features`, `#integrations`                                                                                                             |
| `robots.txt`       | `User-agent: * / Allow: /` + sitemap                                                                                                                        |
| Título/description | "Dreamy" — "Software house especializada em IA, agentes inteligentes e automação de processos. Desenvolvemos sistemas e web apps sob medida para empresas." |
| OG image           | `framerusercontent.com/images/tvg318Dmw9hyPGwQpSmIGf1Udt0.png` (símbolo + "From dreamers to dreamers")                                                      |
| Favicon            | símbolo Dreamy (PNG 522×523)                                                                                                                                |
| Analytics          | GA4 direto via `gtag.js` — propriedade `G-5K32R2LMG3` (sem GTM, sem consentimento)                                                                          |
| Idioma             | `pt-BR`                                                                                                                                                     |

## 2. Inventário de conteúdo (posicionamento antigo)

- Hero: "Desenvolvemos ou melhoramos seu software" + "De apps e automações a agentes de IA e consultoria…" + badge "Novidade! Automatize seu atendimento com IA!"
- Cards de diferenciais: **NoCode/LowCode**, Integração Simplificada, Atualização Contínua.
- "Três formas de acelerar seu crescimento": Web Apps, Agentes de IA, Automações.
- Seção de tecnologias/logos de ferramentas ("Tecnologias que Potencializam Nossas Soluções").
- Processo: Sonhar Junto → Construir o Caminho → Viver o Sonho.
- **Depoimentos** ("Carla Mendes — Studio Criativo", "Ricardo Azevedo — TechSolutions").
- **Métricas**: "+70.000 Requisições por Mês", "5M+ Tokens/Mês", "+34 Projetos".
- Lista extensa de serviços: Web apps, Mobile apps, Agentes de IA, Automações, Landing Pages, Ecommerce, Chatbots, Agentes para WhatsApp, Documentação, Discovery, MVP, UX/UI, Branding, Consultoria, Treinamentos, Workshops.
- Oferta de **consultoria gratuita** ("Fazemos uma consultoria gratuita…").
- FAQ (6 perguntas, incluindo "Vocês trabalham apenas com NoCode/LowCode?").
- Formulário: Nome, Email, Empresa, Telefone, Mensagem (Framer Forms).
- Logos exibidos: Metrifique.se, BeTopVoice, Spotify, hs&e (Homo Sapiens Evolutione), Cultura Soluções Estratégicas — **autorização de uso não confirmada**.
- Fotos de eventos (palestra com dashboard em telão; premiação em campeonato de vôlei) e screenshots de um produto B2C ("Surpreenda") — não adequados ao ICP B2B sem contexto/aprovação.
- Rodapé: "Dreamy © 2025 — Sonhos foram feitos para serem vividos." Links sociais genéricos de template (twitter.com, discord.com, github.com).
- Contato: WhatsApp `https://wa.me/5511948793233` (mesmo número do deck institucional: 11 94879-3233).

### O que o PRD manda descartar

Layout, copy, organização das ofertas, cards de serviços, depoimentos, mensagens antigas, NoCode/LowCode como diferencial, consultoria gratuita, métricas sem comprovação, logos sem autorização.

### O que preservar (nível de acabamento, não arquitetura)

Percepção premium, contraste escuro, personalidade visual, motion sutil, bom uso de espaço, estética tecnológica, qualidade "Framer-like".

## 3. Identidade visual encontrada

### Cores (site atual — tokens Framer)

| Uso                               | Hex                                        |
| --------------------------------- | ------------------------------------------ |
| Fundo                             | `#0C0C0D`                                  |
| Superfície                        | `#26262A`                                  |
| Superfície 2 / borda              | `#303036`                                  |
| Texto secundário                  | `#828289`, `#A1A1AA`                       |
| Bordas claras                     | `#D4D4D8`, `#E2E2E2`                       |
| Off-white                         | `#F9FAFA`, `#F4F4F5`                       |
| **Verde Dreamy (token)**          | **`#46EB7E`**                              |
| Acentos secundários (decorativos) | `#F26D0F`, `#FF9F40`, `#2B63B4`, `#004F80` |

### Verde extraído do logo oficial (`DREAMY_INST_v2.pptx` → `ppt/media/image2.png`, idêntico ao logo do site)

- Cor sólida dominante: `#41E97A`
- Segundo tom mais frequente: **`#46EB7E`** (coincide exatamente com o token do site → adotado como `--brand-primary`)
- Gradiente do símbolo: `#41E97A` → `#4DEE84` → `#5FF592` → `#6BFA9C`
- Wordmark: `#333333`
- Deck institucional usa também `#1ED760` (verde mais escuro para fundos claros) e `#4DEE84`.

### Tipografia

- Site atual: **Urbanist** (títulos, peso 700, 80/72/64/58/48/42/36/32/28/24 px), **Satoshi** (texto, 14–20 px, 400/500/700), Instrument Sans e Plus Jakarta Sans (uso pontual), Inter (fallback Framer).
- Deck institucional: Poppins e Montserrat.
- Não existe arquivo/definição de "tipografia oficial" com licença na pasta de assets (a pasta `FONTES` contém Gilroy para outro projeto — Surpreendi).

### Logo

- Horizontal: símbolo (esfera com três ondas em gradiente verde) + wordmark "Dreamy" (`#333333`). PNG 2401×751 transparente.
- Símbolo isolado: PNG 522×523 (favicon atual).
- Não há versão vetorial (SVG) nem versão com wordmark claro para fundo escuro nos assets encontrados → ver ADR-006.

## 4. Mapa de URLs para migração

| URL antiga        | Tipo         | Ação                            | URL nova                  |
| ----------------- | ------------ | ------------------------------- | ------------------------- |
| `/`               | indexada     | manter                          | `/`                       |
| `/#form`          | âncora       | redirecionar client-side (hash) | `/contato`                |
| `/#tools`         | âncora       | redirecionar client-side (hash) | `/solucoes`               |
| `/#features`      | âncora       | redirecionar client-side (hash) | `/#como-trabalhamos`      |
| `/#integrations`  | âncora       | redirecionar client-side (hash) | `/solucoes/agentes-de-ia` |
| `dreamy.app.br/*` | host sem www | 301                             | `www.dreamy.app.br/*`     |

Detalhes e checklist: `docs/SEO-MIGRATION.md` e `docs/redirect-map.csv`. Search Console e backlinks: **pendente de acesso** (não verificável a partir do HTML).

## 5. Riscos identificados

1. Nenhum case, métrica ou logo com autorização documentada → seções de prova/cases nascem ocultas até aprovação (`docs/CONTENT-SOURCES.md`).
2. Contatos/dados jurídicos (CNPJ, e-mail, endereço) não constam nos assets → configuráveis em `src/config/site.ts`, ocultos quando vazios.
3. GA4 atual instalado direto; a nova arquitetura usa GTM como camada única (evitar duplicidade ao migrar a propriedade).
4. Domínio hoje aponta para Framer; DNS/HTTPS/redirect www precisam ser reconfigurados no lançamento (Fase 8).
5. Assets vetoriais da marca inexistentes → uso de PNG otimizado do logo + símbolo; SVG oficial deve ser solicitado.
