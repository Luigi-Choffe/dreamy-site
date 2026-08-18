<!-- Convertido automaticamente de docs/source/PRD v2.docx (fonte oficial). Em caso de dúvida, o PDF/DOCX original prevalece. -->

# PRD v2.0 — Novo Site Institucional Dreamy

Empresa: Dreamy  
Produto: Site institucional B2B  
Versão: 2.0  
Status: Source of Truth para desenvolvimento  
Mercado inicial: Brasil  
Idioma inicial: Português do Brasil  
Domínio: https://www.dreamy.app.br  
Plataforma de desenvolvimento: Google Antigravity  
Objetivo principal: gerar oportunidades comerciais qualificadas para a Dreamy.

## 0. REGRA FUNDAMENTAL DESTE DOCUMENTO

Este PRD é a fonte de verdade do projeto.  
Se houver conflito entre decisões tomadas durante o desenvolvimento e este documento, seguir esta ordem de prioridade:

- posicionamento e estratégia comercial;
- regras de negócio;
- arquitetura de informação;
- experiência do usuário;
- copy;
- design system;
- implementação técnica.
  O agente pode propor melhorias, mas não deve alterar decisões estratégicas silenciosamente.  
  Quando algo não estiver definido:
- escolher a solução mais simples;
- documentar a decisão;
- evitar criar dependência desnecessária;
- preservar possibilidade de evolução futura.

## 1. INSTRUÇÃO DE EXECUÇÃO PARA O ANTIGRAVITY

Antes de escrever código:

- ler este PRD integralmente;
- analisar o site atual https://www.dreamy.app.br;
- capturar screenshots desktop e mobile;
- criar um Implementation Plan;
- identificar dependências;
- identificar decisões ainda parametrizáveis;
- criar arquitetura de componentes;
- apresentar a estrutura antes da implementação.
  O projeto deve ser realizado preferencialmente utilizando Planning Mode.  
  Não iniciar grandes mudanças diretamente em Fast Mode.  
  Após cada fase:
- executar aplicação;
- abrir no browser;
- testar fluxos;
- verificar console;
- executar testes;
- verificar responsividade;
- capturar screenshots;
- gerar walkthrough da implementação.

## 2. REGRAS INEGOCIÁVEIS

O site NÃO pode:

- vender NoCode/LowCode como oferta;
- comunicar Bubble ou ferramentas semelhantes como diferencial;
- parecer uma agência generalista;
- listar dezenas de serviços;
- vender landing pages;
- vender branding;
- vender e-commerce;
- vender desenvolvimento de MVP como produto principal;
- vender treinamento como produto principal;
- oferecer consultoria gratuita;
- utilizar depoimentos;
- utilizar testemunhos fictícios;
- utilizar nomes fictícios de clientes;
- utilizar logos sem autorização;
- inventar métricas;
- inventar percentuais de resultado;
- inventar cases;
- inventar números de usuários;
- inventar resultados financeiros;
- utilizar imagens genéricas de robôs;
- utilizar imagens clichês de “cérebro digital”;
- parecer template genérico de startup de IA.
  O site DEVE:
- parecer premium;
- comunicar software personalizado;
- comunicar visão de negócio;
- falar com empresários;
- ser compreensível para pessoas não técnicas;
- apresentar exatamente três ofertas principais;
- utilizar tecnologia como meio;
- utilizar resultado como mensagem;
- demonstrar competência através de projetos reais;
- ter conversão mensurável;
- ter SEO implementado corretamente;
- ter analytics desde o lançamento;
- ser rápido;
- ser acessível;
- funcionar perfeitamente em mobile.

## 3. CONTEXTO

A Dreamy está mudando de posicionamento.  
O posicionamento anterior enfatizava:

- NoCode/LowCode;
- Web Apps;
- agentes de IA;
- automações;
- diferentes tecnologias;
- MVP;
- UX/UI;
- landing pages;
- e-commerce;
- branding;
- treinamentos;
- consultoria.
  Esse excesso de opções tornava menos evidente o que o cliente deveria comprar.  
  O novo posicionamento reduz a oferta para três problemas comerciais claros.

## 4. NOVO POSICIONAMENTO

Categoria  
Software sob medida e Inteligência Artificial para empresas.  
Proposta central  
Criamos tecnologia para sua empresa ganhar mais e operar melhor.  
Explicação  
A Dreamy desenvolve produtos digitais, sistemas personalizados e agentes de IA para empresas que possuem oportunidades ou problemas que softwares prontos não resolvem adequadamente.  
Princípio  
Começamos pelo problema de negócio. A tecnologia vem depois.

## 5. O QUE A DREAMY NÃO VENDE

A tecnologia utilizada não é o produto.  
React, Next.js, Python, APIs, bancos de dados, inteligência artificial, automação, NoCode ou qualquer framework são ferramentas internas.  
O cliente compra:

- aumento de capacidade;
- nova receita;
- redução de gargalo;
- automação;
- produtividade;
- informação;
- velocidade;
- escala;
- melhor experiência;
- vantagem competitiva.

## 6. OBJETIVOS DO SITE

Objetivo principal  
Gerar reuniões comerciais qualificadas.  
Objetivos secundários

- explicar a Dreamy em menos de 10 segundos;
- posicionar a empresa como parceira estratégica de tecnologia;
- aumentar percepção de valor;
- demonstrar competência;
- reduzir leads fora do ICP;
- apoiar prospecção ativa;
- servir como destino para LinkedIn, WhatsApp, eventos e indicações;
- construir autoridade orgânica;
- melhorar capacidade de mensurar aquisição;
- preparar infraestrutura para mídia paga.

## 7. NON-GOALS — FORA DO ESCOPO V1

Não construir na primeira versão:

- área de cliente;
- login;
- dashboard administrativo;
- plataforma SaaS;
- chat com IA no site;
- demonstração de agente ao vivo;
- calculadora de preços;
- e-commerce;
- checkout;
- portal de parceiros;
- sistema próprio de CRM;
- CMS complexo;
- multilíngue;
- dezenas de landing pages;
- central de documentação;
- comunidade.
  Não adicionar funcionalidades porque “ficariam legais”.  
  Cada funcionalidade precisa apoiar:  
  credibilidade, compreensão ou conversão.

## 8. ICP

Empresa ideal  
Empresa estabelecida, preferencialmente:

- faturamento entre aproximadamente R$ 15 milhões e R$ 150 milhões por ano;
- 30–300 colaboradores;
- operação já validada;
- base de clientes existente;
- equipe comercial ou operacional relevante;
- processos recorrentes;
- algum nível de digitalização;
- utilização de CRM, ERP, planilhas, WhatsApp ou sistemas próprios;
- capacidade financeira para projetos personalizados;
- ausência de grande estrutura interna de software.
  Faturamento não deverá aparecer como requisito público do site.

## 9. COMPRADOR PRINCIPAL

Prioridade:

- Founder;
- Sócio;
- CEO;
- Diretor-geral;
- COO;
- Diretor Comercial;
- Diretor de Operações;
- Diretor de Tecnologia/Inovação.
  O site deve falar prioritariamente com quem percebe impacto econômico, e não apenas impacto técnico.

## 10. JOBS TO BE DONE

O visitante normalmente chega pensando algo semelhante a:  
JTBD 1  
“Existe dinheiro na minha base de clientes que eu poderia capturar com um novo produto.”  
JTBD 2  
“Minha empresa possui um processo ruim e nenhum software existente resolve direito.”  
JTBD 3  
“Todo mundo fala de IA, mas eu quero encontrar alguma aplicação que gere resultado de verdade.”  
JTBD 4  
“Minha equipe está gastando muito tempo executando trabalho repetitivo.”  
JTBD 5  
“Tenho informação demais espalhada e pouca visibilidade.”  
JTBD 6  
“Meu negócio cresceu e nossa operação não acompanhou.”

## 11. AS TRÊS OFERTAS

Existem exatamente três ofertas comerciais principais.

### 11.1 NOVA RECEITA DIGITAL

Categoria  
Desenvolvimento de novos produtos digitais.  
Promessa  
Transforme sua base de clientes em uma nova fonte de receita.  
Problema  
Empresas frequentemente já possuem:

- clientes;
- conhecimento;
- dados;
- processos;
- relacionamento;
- autoridade;
- distribuição.
  Mas monetizam isso apenas através do produto principal.  
  A Dreamy identifica oportunidades de transformar esses ativos em um produto digital.  
  Exemplos possíveis
- plataforma;
- portal premium;
- ferramenta complementar;
- assinatura;
- SaaS;
- serviço digital;
- produto B2B;
- software para clientes existentes.
  Os exemplos servem para entendimento.  
  Não transformar a página em catálogo.  
  Processo  
  Oportunidade  
  → validação  
  → modelo de negócio  
  → produto  
  → desenvolvimento  
  → lançamento  
  → evolução.  
  CTA  
  Explorar uma nova receita

### 11.2 SISTEMAS SOB MEDIDA

Promessa  
Sua operação é única. Seu sistema também pode ser.  
Problema  
Softwares genéricos obrigam empresas a adaptarem seus processos.  
Em determinadas operações, essa adaptação:

- aumenta trabalho;
- gera planilhas paralelas;
- cria retrabalho;
- fragmenta dados;
- reduz produtividade.
  Solução  
  A Dreamy desenvolve sistemas construídos especificamente em torno da operação.  
  Possibilidades:
- sistema interno;
- dashboard;
- CRM personalizado;
- portal;
- ferramenta de gestão;
- sistema comercial;
- automação;
- integrações.
  Mensagem fundamental  
  Você não precisa chegar sabendo qual sistema desenvolver.  
  A Dreamy começa entendendo o problema.  
  Processo  
  Problema  
  → processo  
  → arquitetura  
  → experiência  
  → desenvolvimento  
  → integração  
  → implantação.  
  CTA  
  Resolver um gargalo

### 11.3 AGENTES DE IA

Promessa  
Coloque a IA para executar trabalho dentro da sua empresa.  
Posicionamento  
Não vender chatbot.  
Não vender “ChatGPT personalizado”.  
Apresentar agentes como software capaz de interpretar informações, acessar ferramentas autorizadas e executar etapas de determinados processos.  
Três casos de uso prioritários  
Atendimento

- responder;
- consultar informações;
- qualificar;
- registrar;
- encaminhar;
- atualizar CRM;
- agendar;
- apoiar o cliente.
  Comercial
- pesquisar prospects;
- enriquecer informações;
- preparar vendedor;
- qualificar;
- criar follow-ups;
- priorizar leads;
- resumir oportunidades;
- atualizar CRM.
  Operação
- consultar documentos;
- consolidar informações;
- gerar relatórios;
- buscar dados;
- executar processos;
- utilizar sistemas internos;
- automatizar tarefas multi-etapas.
  Princípio  
  IA deve atuar dentro de:
- escopo;
- regras;
- permissões;
- integrações;
- handoff humano quando necessário.
  CTA  
  Encontrar uma aplicação para IA

## 12. MENSAGEM EM 5 SEGUNDOS

Após cinco segundos na Home, o visitante deve entender:  
O que é a Dreamy?  
Empresa de software e IA.  
O que faz?  
Cria tecnologia personalizada.  
Para quem?  
Empresas estabelecidas.  
Para quê?  
Gerar receita ou melhorar operações.  
O que posso contratar?  
Nova Receita Digital.  
Sistemas Sob Medida.  
Agentes de IA.  
Se isso não estiver claro, o Hero falhou.

## 13. ARQUITETURA DE INFORMAÇÃO

Rotas planejadas:  
/  
/solucoes  
/solucoes/nova-receita-digital  
/solucoes/sistemas-sob-medida  
/solucoes/agentes-de-ia

/cases  
/cases/[slug]

/sobre

/insights  
/insights/[slug]

/contato

/privacidade  
/cookies  
Regra para Insights  
Não mostrar “Insights” na navegação se houver menos de três conteúdos úteis publicados.  
Nunca lançar uma seção de blog vazia.  
Regra para Cases  
Se houver apenas um case completo, pode-se mostrar o case diretamente na Home e manter /cases simples.  
Não criar cases fictícios apenas para preencher a página.

## 14. HEADER

Desktop:  
Logo Dreamy  
Navegação:

- Soluções
- Cases
- Como trabalhamos
- Sobre
- Insights
  CTA:  
  Agendar conversa  
  Soluções  
  Dropdown contendo apenas:
- Nova Receita Digital
- Sistemas Sob Medida
- Agentes de IA
  Comportamento  
  Header:
- sticky;
- fundo inicialmente discreto;
- superfície mais definida após scroll;
- blur leve permitido;
- sem ocupar espaço excessivo.
  Mobile:  
  menu hambúrguer acessível.  
  CTA presente.

## 15. HOME — SEÇÃO 1 — HERO

Eyebrow  
SOFTWARE SOB MEDIDA + INTELIGÊNCIA ARTIFICIAL  
H1  
Tecnologia sob medida para sua empresa ganhar mais e operar melhor.  
Texto  
Criamos novos produtos digitais, sistemas personalizados e agentes de IA para desafios que softwares prontos não resolvem.  
CTA principal  
Conversar sobre meu negócio  
CTA secundário  
Conhecer as soluções  
Microcopy  
Começamos pelo problema. A tecnologia vem depois.

## 16. HERO — DIREÇÃO VISUAL

Não utilizar fotografia de banco de imagem.  
Não utilizar robô.  
Não utilizar cérebro.  
Não utilizar holograma.  
Não utilizar códigos flutuando.  
Criar elemento visual próprio da Dreamy.  
Direção recomendada:  
uma representação abstrata de uma empresa conectando:

- dados;
- clientes;
- sistemas;
- operação;
- IA;
- receita.
  Pode existir fluxo animado entre nós.  
  Motion lento e sofisticado.  
  Evitar WebGL pesado inicialmente.  
  Preferir:
- SVG;
- CSS;
- Motion;
- transforms acelerados por GPU.

## 17. HOME — PROVA

Headline possível  
Tecnologia que já está em operação.  
A seção não deverá utilizar depoimentos.  
Pode utilizar:  
Logos  
Somente clientes autorizados.  
Produtos  
Screenshots reais.  
Cases  
Problema + solução + resultado.  
Indicadores  
Somente números comprováveis.  
Exemplos de estrutura:  
X projetos entregues  
somente se comprovável.  
X requisições processadas  
somente se comprovável.  
X usuários  
somente se comprovável.

## 18. REGRA DE INTEGRIDADE DA PROVA

Todo dado comercial apresentado deve possuir uma origem verificável.  
Criar arquivo interno:  
docs/CONTENT-SOURCES.md  
Exemplo:  
Claim:  
"70.000 requisições mensais"

Source:  
[documento / analytics / banco]

Verified:  
yes

Approved for public website:  
yes  
Nenhum indicador deve entrar no código sem aprovação.  
Não criar campo de testimonial no modelo de conteúdo.

## 19. HOME — O PROBLEMA

H2  
Nem todo problema da sua empresa cabe em um software pronto.  
Copy  
Sua empresa cresce.  
Os processos ficam mais específicos.  
Sistemas deixam de conversar.  
Planilhas passam a sustentar decisões importantes.  
Informações dependem de pessoas.  
Leads deixam de receber acompanhamento.  
E oportunidades que poderiam virar receita ficam paradas porque a tecnologia disponível não acompanha o negócio.  
É nesse ponto que entramos.

## 20. HOME — TRÊS SOLUÇÕES

H2  
Três formas de transformar tecnologia em resultado.  
01 — Nova Receita Digital  
Crie o próximo produto que seus clientes podem comprar.  
Transformamos oportunidades dentro da base e do conhecimento da empresa em novos produtos digitais.  
CTA:  
Explorar oportunidade →

02 — Sistemas Sob Medida  
Construa tecnologia em torno da sua operação.  
Criamos sistemas específicos para eliminar gargalos, centralizar informações e aumentar produtividade.  
CTA:  
Resolver operação →

03 — Agentes de IA  
Faça a IA executar trabalho real.  
Criamos agentes conectados aos sistemas, dados e processos da empresa.  
CTA:  
Aplicar IA →

## 21. HOME — DIAGNÓSTICO

H2  
Você não precisa saber o que construir.  
Texto  
Normalmente, nossos clientes chegam com uma dor.  
Não com uma especificação técnica.  
Eles sabem que determinada atividade demora demais.  
Que uma oportunidade comercial está sendo desperdiçada.  
Que informações estão espalhadas.  
Ou que alguma parte da operação não escala.  
Nosso trabalho começa identificando qual tecnologia faz sentido construir — se fizer sentido construir alguma.  
Fluxo  
DOR  
↓  
IMPACTO  
↓  
OPORTUNIDADE  
↓  
SOLUÇÃO  
↓  
TECNOLOGIA  
↓  
RESULTADO

## 22. HOME — CASES

H2  
Problemas reais. Tecnologia em produção.  
Cada card deverá apresentar:  
Cliente  
Contexto  
Problema  
O que construímos  
Resultado comprovável  
CTA:  
Ver case  
Não utilizar

- frases promocionais vagas;
- resultado sem número ou explicação;
- porcentagens inventadas;
- testemunhos.
  Se não houver resultado financeiro mensurado, apresentar resultado operacional.  
  Exemplo:  
  Antes:  
  “cadastro dependia de processo manual.”  
  Depois:  
  “cadastro passou a ser realizado através de fluxo automatizado conectado ao sistema.”  
  Isso é válido se verificável.

## 23. HOME — COMO TRABALHAMOS

H2  
Da dor ao software.  
01 — Entender  
Mapeamos problema, impacto e contexto.  
02 — Desenhar  
Definimos solução, experiência, arquitetura e integrações.  
03 — Construir  
Desenvolvemos em ciclos curtos e validamos continuamente.  
04 — Colocar para trabalhar  
Implantamos a solução na operação real.  
05 — Evoluir  
Acompanhamos uso, resultados e novas oportunidades.

## 24. HOME — FIT

H2  
Para empresas que já têm operação — e querem chegar ao próximo nível.  
Cards ou lista visual:  
Processos que não escalam  
Sistemas desconectados  
Base relevante de clientes  
Equipe comercial  
Dados espalhados  
Oportunidades digitais ainda não exploradas  
Final:  
Se a empresa já funciona, mas a tecnologia começou a limitar seu crescimento, provavelmente existe algo que podemos construir.

## 25. HOME — FAQ

Preciso saber exatamente qual sistema quero?  
Não. Muitas vezes nossos clientes chegam com um problema, não com uma especificação. Começamos entendendo a operação e estruturamos a solução antes de iniciar o desenvolvimento.

A Dreamy trabalha com softwares que minha empresa já utiliza?  
Sim. Podemos desenvolver novos sistemas e integrá-los à estrutura existente quando houver mecanismos técnicos disponíveis.

Vocês integram ERP, CRM e outras plataformas?  
Sim, quando as plataformas oferecem APIs ou outros mecanismos compatíveis. A Dreamy desenvolve e mantém a camada de integração sob sua responsabilidade, mas disponibilidade e limitações técnicas de serviços externos dependem dos respectivos fornecedores.

O que diferencia um agente de IA de um chatbot?  
Um chatbot normalmente se concentra na conversa. Um agente pode ser desenvolvido para consultar informações, interagir com sistemas e executar etapas de processos definidos.

A Dreamy trabalha somente com IA?  
Não. IA é uma ferramenta. Em muitos casos, um sistema tradicional ou uma automação simples é uma solução melhor.

Quanto tempo leva um projeto?  
Depende do problema, escopo e integrações necessárias. Após o diagnóstico, estruturamos escopo, etapas e cronograma antes de iniciar o desenvolvimento.

A Dreamy oferece manutenção?  
Projetos podem incluir planos de manutenção e evolução após a entrada em produção, definidos conforme escopo e necessidade.

## 26. HOME — CTA FINAL

H2  
Qual problema da sua empresa valeria a pena resolver agora?  
Texto  
Conte o contexto.  
Vamos entender a oportunidade e avaliar se existe uma solução tecnológica capaz de gerar impacto relevante.  
CTA  
Conversar com a Dreamy  
Microcopy:  
Sem apresentação genérica. Vamos falar sobre o seu negócio.

## 27. PÁGINA — NOVA RECEITA DIGITAL

URL:  
/solucoes/nova-receita-digital  
H1  
Transforme sua base de clientes em uma nova fonte de receita.  
Intro  
Sua empresa já conquistou clientes, conhecimento, distribuição e confiança.  
A próxima oportunidade pode estar em transformar parte disso em um produto digital que os clientes também estejam dispostos a comprar.

Seção problema  
H2  
Você talvez já tenha o ativo. Falta transformá-lo em produto.  
Explorar:

- conhecimento;
- processo;
- dados;
- serviço;
- distribuição;
- comunidade;
- relacionamento.

Seção solução  
H2  
Da oportunidade ao produto em produção.  
Dreamy atua em:

- entendimento;
- oportunidade;
- modelo;
- experiência;
- software;
- integrações;
- lançamento;
- evolução.

Tipos possíveis  
Apresentar exemplos discretamente:

- SaaS;
- portal;
- plataforma;
- assinatura;
- ferramenta complementar;
- produto B2B.

Pergunta estratégica  
Criar destaque visual:  
Se apenas uma parte dos seus clientes pagasse por um novo produto digital, o que valeria a pena construir?

CTA  
Explorar uma oportunidade  
Link:  
/contato?solucao=nova-receita

## 28. PÁGINA — SISTEMAS SOB MEDIDA

URL:  
/solucoes/sistemas-sob-medida  
H1  
Sua operação é única. Seu sistema também pode ser.  
Intro  
Quando o software existente exige que sua empresa mude demais para utilizá-lo, pode ser hora de construir a tecnologia em torno do negócio — e não o contrário.

Problemas

- trabalho manual;
- dados espalhados;
- planilhas críticas;
- retrabalho;
- sistemas desconectados;
- informações difíceis de consultar;
- processo específico demais para software genérico.

H2  
Você não precisa chegar com a solução pronta.  
Copy:  
Você conhece seu negócio.  
Nós conhecemos tecnologia.  
Começamos entendendo o processo e desenhamos juntos a solução necessária.

Exemplos

- dashboards;
- sistemas internos;
- CRMs;
- portais;
- ferramentas comerciais;
- gestão de processos;
- integrações.
  Não apresentar como pacotes independentes.

CTA  
Resolver um gargalo  
/contato?solucao=sistema

## 29. PÁGINA — AGENTES DE IA

URL:  
/solucoes/agentes-de-ia  
H1  
Coloque a IA para executar trabalho dentro da sua empresa.  
Intro  
IA gera valor quando deixa de ser apenas uma conversa e passa a participar de processos reais.  
Criamos agentes conectados aos dados, sistemas e ferramentas da empresa.

H2  
Onde um agente pode trabalhar?  
Atendimento  
Fluxo visual:  
Cliente  
→ agente  
→ informações  
→ CRM  
→ humano quando necessário.

Vendas  
Lead  
→ pesquisa  
→ qualificação  
→ priorização  
→ follow-up  
→ vendedor.

Operação  
Sistemas + documentos + dados  
→ agente  
→ análise  
→ ação.

Seção segurança conceitual  
H2  
Autonomia não significa falta de controle.  
Agentes devem operar com:

- escopo definido;
- permissões;
- regras;
- rastreabilidade quando aplicável;
- pontos de confirmação;
- handoff humano.

Seção integração  
H2  
O valor aparece quando a IA conhece o contexto da empresa.  
Representar visualmente conexões com:  
CRM  
ERP  
WhatsApp  
E-mail  
Banco de dados  
Documentos  
APIs.  
Não usar logos de ferramentas sem necessidade.

CTA  
Encontrar uma aplicação para IA  
/contato?solucao=agente-ia

## 30. PÁGINA — CASES

URL:  
/cases  
H1  
Tecnologia aplicada a problemas reais.  
Não transformar a página em portfolio de design.  
Cases devem mostrar raciocínio de negócio.  
Card:  
Cliente  
Setor  
Problema  
Solução construída  
Resultado

## 31. CASE INDIVIDUAL

URL:  
/cases/[slug]  
Estrutura:  
Hero  
Cliente  
Setor  
Resumo.  
01 — Contexto  
Como funcionava a operação.  
02 — Problema  
O que estava impedindo crescimento/eficiência.  
03 — Solução  
O que foi construído.  
04 — Como funciona  
Diagrama visual.  
05 — Resultado  
Indicadores verificáveis.  
06 — Produto  
Screenshots reais.  
CTA  
Existe algo parecido na sua empresa?  
Conversar com a Dreamy

## 32. PÁGINA — SOBRE

URL:  
/sobre  
H1  
Construímos tecnologia quando a solução pronta não basta.  
Copy base  
A Dreamy é uma empresa de desenvolvimento de software e inteligência artificial.  
Trabalhamos com empresas que possuem problemas específicos, processos próprios ou oportunidades que exigem tecnologia construída em torno do negócio.  
Não começamos escolhendo ferramenta.  
Começamos entendendo o problema.

Princípios  
Negócio antes da tecnologia  
Simplicidade antes da complexidade  
Software deve gerar consequência  
IA precisa executar algo útil  
Produto continua evoluindo depois do lançamento

## 33. PÁGINA — INSIGHTS

Não lançar até existirem pelo menos três conteúdos relevantes.  
Objetivo:  
SEO + autoridade.  
Não criar conteúdo genérico sobre:  
“o que é inteligência artificial”.  
Priorizar intenção do ICP.  
Backlog inicial

- Como saber se sua empresa precisa de um software sob medida
- Quando um sistema personalizado faz sentido — e quando não faz
- Como transformar uma base de clientes em um novo produto digital
- Onde agentes de IA realmente geram valor em empresas
- O custo invisível de processos sustentados por planilhas
- IA no atendimento: onde automatizar e onde manter humanos
- Como identificar processos candidatos à automação
- Quando desenvolver software próprio pode virar vantagem competitiva
- SaaS B2B: como transformar conhecimento de mercado em produto
- Por que conectar IA ao CRM muda mais do que adicionar um chatbot

## 34. FORMULÁRIO DE CONTATO

URL:  
/contato  
H1  
Vamos entender o que vale a pena construir.  
Estrutura recomendada  
Formulário em duas etapas.  
Isso reduz percepção de formulário longo.

## 35. FORMULÁRIO — ETAPA 1

Nome  
Obrigatório.  
Empresa  
Obrigatório.  
Cargo  
Obrigatório.  
E-mail  
Obrigatório.  
Preferencialmente profissional, mas não bloquear Gmail, Outlook ou outros provedores gratuitos.  
WhatsApp / telefone  
Obrigatório.

## 36. FORMULÁRIO — ETAPA 2

Qual situação descreve melhor o que você procura?

- Quero criar uma nova fonte de receita
- Preciso desenvolver um sistema
- Quero aplicar IA na empresa
- Tenho uma dor, mas ainda não sei qual solução preciso
- Outro

Qual problema ou oportunidade você quer resolver?  
Textarea.  
Obrigatório.

Quão urgente é isso?

- Agora
- Próximos 30 dias
- 1–3 meses
- 3–6 meses
- Apenas pesquisando

Existe uma faixa de investimento prevista?

- Até R$ 20 mil
- R$ 20–50 mil
- R$ 50–100 mil
- R$ 100–250 mil
- Acima de R$ 250 mil
- Ainda não definimos
  Não tornar orçamento obrigatório.

## 37. ESTADOS DO FORMULÁRIO

Implementar:

- idle;
- focus;
- validation error;
- submitting;
- success;
- server error;
- network error.
  Regras  
  Ao ocorrer erro:
- não apagar campos;
- posicionar foco corretamente;
- apresentar mensagem legível;
- permitir retry.
  Botão de envio fica desabilitado durante submissão.  
  Prevenir double-submit.

## 38. LEAD SCORING

Executado somente server-side.  
Score não aparece ao visitante.  
Exemplo inicial:  
Cargo executivo: +20  
Empresa no ICP: +20  
Urgência ≤ 90 dias: +20  
Dor detalhada: +15  
Investimento ≥ R$ 20 mil: +15  
Solução identificada: +10  
Máximo:
-

Buckets  
75–100:  
prioridade alta.  
50–74:  
prioridade média.  
0–49:  
avaliação/nurturing.  
O scoring deverá ser configurável.  
Não deixar regras espalhadas pelos componentes.

## 39. PÓS-CONVERSÃO

Após envio:  
Mensagem  
Recebemos seu contexto.  
Vamos analisar o que você enviou e entrar em contato para avaliar o próximo passo.  
Quando houver ferramenta de agendamento configurada, poderá ser apresentado:  
Quer adiantar a conversa? Escolha um horário.  
Não prometer retorno em prazo específico se isso não estiver operacionalmente garantido.

## 40. MODELO DE DADOS DO LEAD

Armazenar:

- lead_id;
- created_at;
- nome;
- email;
- telefone;
- empresa;
- cargo;
- necessidade;
- descrição;
- urgência;
- investimento;
- lead_score;
- lead_bucket;
- landing_page;
- referrer;
- utm_source;
- utm_medium;
- utm_campaign;
- utm_content;
- utm_term.
  Nunca enviar nome, e-mail, telefone ou texto do problema para GA4, Meta ou LinkedIn Analytics.  
  PII fica restrita ao fluxo comercial.

## 41. INTEGRAÇÃO DO LEAD

Arquitetura:  
LeadForm  
↓  
Server validation  
↓  
Lead service  
↓  
CRM Adapter  
↓  
Notification Adapter  
↓  
Analytics conversion  
Criar interfaces desacopladas.  
Exemplo conceitual:  
CRMProvider  
NotificationProvider  
SchedulingProvider  
Isso deverá permitir trocar CRM futuramente sem reescrever o formulário.

## 42. RESILIÊNCIA DO FORMULÁRIO

Implementar:

- validação server-side;
- request ID;
- idempotência;
- retry seguro para integrações;
- logs de falha;
- tratamento de timeout.
  Uma falha na notificação por e-mail não deverá necessariamente destruir um lead enviado com sucesso ao CRM.  
  Uma falha do CRM deve gerar erro observável.

## 43. ANALYTICS

Utilizar Google Tag Manager como camada central de orquestração de tags.  
Não instalar GA4 duplicadamente através de GTM e implementação direta.  
Integrações:

- Google Tag Manager;
- Google Analytics 4;
- Google Search Console;
- Meta Pixel;
- LinkedIn Insight Tag.
  Preparar possibilidade futura para:
- Google Ads;
- Meta Conversions API;
- LinkedIn Conversions API;
- server-side tagging.

## 44. DATA LAYER

Criar contrato documentado em:  
docs/TRACKING.md  
Eventos:  
page_view  
cta_click  
Parâmetros:

- cta_id;
- cta_location;
- page;
- intent.
  solution_view
- solution;
  case_view
- case_slug;
  form_start  
  form_step_complete
- step;
  form_error
- field;
- error_type.
  Nunca enviar valor preenchido.  
  generate_lead  
  Evento principal de conversão.  
  Parâmetros permitidos:
- solution;
- lead_bucket;
- urgency_bucket.
  schedule_start  
  meeting_scheduled  
  Se tecnicamente mensurável.

## 45. ATRIBUIÇÃO

Capturar UTMs existentes na URL.  
Preservar durante o fluxo de contato.  
Capturar:

- source;
- medium;
- campaign;
- content;
- term;
- referrer;
- landing page.
  Não implementar fingerprinting.  
  Persistência entre sessões deverá respeitar política de consentimento definida.

## 46. SEO — POSICIONAMENTO

Clusters prioritários.  
Software personalizado

- desenvolvimento de software sob medida;
- desenvolvimento de sistemas sob medida;
- software personalizado;
- empresa de desenvolvimento de sistemas;
- sistema personalizado para empresas.
  IA
- agentes de IA para empresas;
- agente de IA;
- IA para atendimento;
- IA para vendas;
- IA integrada ao CRM;
- IA para WhatsApp;
- automação com IA.
  Sistemas
- dashboard empresarial;
- dashboard personalizado;
- sistema interno personalizado;
- CRM personalizado;
- software para processos internos.
  Receita
- desenvolvimento de produto digital;
- criação de SaaS;
- produto digital B2B;
- monetização de base de clientes.
  Não inventar volume de busca.  
  Pesquisa de volume deverá ser realizada posteriormente utilizando ferramenta adequada.

## 47. SEO — METADATA

Home  
Title:  
Dreamy | Software sob medida e Agentes de IA  
Description:  
Criamos produtos digitais, sistemas personalizados e agentes de IA para empresas que querem aumentar receita e melhorar operações.

Nova Receita Digital  
Title:  
Desenvolvimento de Produtos Digitais e SaaS | Dreamy

Sistemas  
Title:  
Desenvolvimento de Sistemas Sob Medida | Dreamy

IA  
Title:  
Agentes de IA para Empresas | Dreamy

Todas as páginas:

- title;
- description;
- canonical;
- OG title;
- OG description;
- OG image;
- social metadata.

## 48. SEO — NEXT.JS

Utilizar Metadata API do Next.js.  
Preferir:

- metadata estática quando possível;
- generateMetadata para conteúdo dinâmico.
  Utilizar convenções nativas para:
- favicon;
- icons;
- robots;
- sitemap;
- Open Graph.

## 49. STRUCTURED DATA

Home:

- Organization;
- WebSite.
  Soluções:
- Service;
- BreadcrumbList.
  Cases:
- BreadcrumbList.
  Insights:
- Article;
- BreadcrumbList.
  Não gerar avaliações estruturadas.  
  Não gerar estrelas.  
  Não criar review schema.  
  Não adicionar dados inexistentes.

## 50. SEO — REGRAS DE CONTEÚDO

Somente um H1 por página.  
Hierarquia semântica:  
H1  
→ H2  
→ H3.  
Nunca utilizar heading apenas para tamanho visual.  
Texto crítico para SEO deve existir no HTML.  
Não colocar conteúdo essencial exclusivamente dentro de:

- canvas;
- vídeo;
- SVG sem alternativa textual;
- imagem.

## 51. MIGRAÇÃO DO SITE ATUAL

Antes do lançamento:

- rastrear todas as URLs existentes;
- consultar sitemap atual;
- consultar Search Console;
- identificar páginas indexadas;
- identificar backlinks relevantes;
- criar mapa de redirects.
  Criar:  
  docs/SEO-MIGRATION.md  
  e:  
  docs/redirect-map.csv  
  Formato:  
  old_url,new_url,status  
  /url-antiga,/url-nova,301  
  Nunca remover URL indexada relevante sem redirect.

## 52. DOMÍNIO

Manter:  
https://www.dreamy.app.br  
como host canônico inicialmente para preservar continuidade.  
Garantir:  
https://dreamy.app.br  
→ redirect permanente para https://www.dreamy.app.br.  
Garantir HTTP → HTTPS.

## 53. PREVIEW E STAGING

Deploys de preview não podem aparecer nos buscadores.  
Implementar:  
noindex  
em ambientes que não sejam produção.  
Não permitir que staging gere páginas indexadas concorrendo com produção.

## 54. DESIGN — PRINCÍPIOS

A aparência deve comunicar:

- precisão;
- tecnologia;
- maturidade;
- confiança;
- sofisticação;
- clareza.
  Não deve comunicar:
- agência criativa;
- adolescente hacker;
- startup experimental;
- template de IA;
- metaverso;
- cyberpunk.

## 55. DESIGN — REFERÊNCIA DO SITE ATUAL

Antes do redesign, utilizar browser para analisar o site atual.  
Preservar:

- percepção premium;
- contraste escuro;
- personalidade visual Dreamy;
- motion;
- bom uso de espaço;
- estética tecnológica;
- qualidade visual semelhante a Framer.
  Não preservar:
- layout;
- copy;
- organização das ofertas;
- cards de serviços;
- depoimentos;
- mensagens antigas.
  O site atual é uma referência de nível de acabamento, não de arquitetura.

## 56. PALETA

Usar identidade Dreamy existente.  
A cor verde da marca deve ser extraída dos assets oficiais existentes.  
Não adivinhar o verde.  
Criar tokens:  
--brand-primary

--background  
--background-secondary

--surface  
--surface-hover

--foreground  
--foreground-muted

--border  
--border-strong

--success  
--error  
Base visual:  
quase preto + off-white + verde Dreamy.  
Evitar excesso de verde.  
Accent deve direcionar atenção.

## 57. TIPOGRAFIA

Prioridade:  
utilizar tipografia oficial Dreamy se houver arquivo/licença/definição existente.  
Caso não exista:  
utilizar fonte moderna, limpa e open-source.  
Sugestão inicial:  
Geist / equivalente contemporâneo.  
Não adicionar várias famílias tipográficas.  
Meta:  
uma família principal.  
No máximo uma família secundária se houver justificativa visual.

## 58. ESCALA TIPOGRÁFICA

Utilizar clamp().  
Hero desktop:  
aproximadamente 64–80 px conforme viewport.  
Hero mobile:  
aproximadamente 38–48 px.  
H2:  
aproximadamente 40–56 px desktop.  
Body:  
16–18 px.  
Não usar fonte pequena para parecer sofisticado.  
Legibilidade tem prioridade.

## 59. LAYOUT

Container máximo:  
aproximadamente 1280 px.  
Largura de leitura:  
60–75 caracteres.  
Espaçamento vertical generoso.  
Evitar seção após seção utilizando exatamente:  
título + três cards.  
Criar variação de ritmo visual.  
Exemplo:  
Hero  
→ proof strip  
→ copy editorial  
→ cards  
→ visual de processo  
→ case grande  
→ etapas  
→ CTA.

## 60. MOTION

Motion deve explicar ou reforçar hierarquia.  
Permitido:

- fade;
- translate;
- stagger;
- line drawing;
- node connections;
- subtle parallax;
- hover states;
- counters comprováveis;
- reveals.
  Evitar:
- animações longas;
- scroll hijacking;
- cursor customizado;
- elementos perseguindo mouse;
- vídeos pesados;
- WebGL sem necessidade;
- excesso de blur animado.
  Respeitar:  
  prefers-reduced-motion.

## 61. VISUAL DOS PRODUTOS

Preferir visualização abstrata inspirada em sistemas reais.  
Nova Receita  
Fluxo:  
Base atual  
→ produto  
→ assinatura  
→ receita recorrente.  
Sistemas  
Fluxo:  
Dados  
→ sistema  
→ dashboard  
→ decisão.  
Agentes  
Fluxo:  
Humano  
→ agente  
→ ferramentas  
→ ação  
→ retorno.  
Criar esses gráficos com componentes reutilizáveis.

## 62. COMPONENTES

Criar:  
Layout

- Header
- MobileNavigation
- Footer
- Container
- Section
- Grid
  UI
- Button
- LinkButton
- Badge
- Card
- Input
- Select
- Textarea
- Checkbox
- Accordion
- Dialog
- Toast
  Marketing
- Hero
- SolutionCard
- CaseCard
- ProofMetric
- ProcessStep
- AgentFlow
- SystemDiagram
- CTASection
- FAQ
- LeadForm
  Content
- ArticleCard
- Breadcrumbs
- RichText
- CaseMetric

## 63. COMPONENT STATES

Todo componente interativo deve definir:

- default;
- hover;
- active;
- focus-visible;
- disabled;
- loading;
- error quando aplicável.
  Não considerar o componente finalizado sem esses estados.

## 64. RESPONSIVIDADE

Abordagem mobile-first.  
Validar:  
320 px  
375 px  
390 px  
768 px  
1024 px  
1280 px  
1440 px  
1920 px.  
Não criar horizontal overflow.  
Nenhuma interação essencial pode depender de hover.  
CTAs principais devem continuar visíveis e utilizáveis em mobile.

## 65. ACESSIBILIDADE

Meta:  
WCAG 2.2 AA.  
Requisitos:

- HTML semântico;
- navegação por teclado;
- focus-visible;
- skip link;
- labels corretos;
- mensagens de erro acessíveis;
- alt text para conteúdo;
- imagens decorativas sem descrição desnecessária;
- contraste adequado;
- ordem de tab lógica;
- headings semânticos;
- modal com focus trap;
- menu mobile acessível;
- reduced motion.
  Adicionar testes automatizados de acessibilidade.

## 66. STACK

Stack recomendada:

- Next.js;
- App Router;
- React;
- TypeScript;
- Tailwind CSS;
- Motion;
- Zod;
- MDX para conteúdo;
- pnpm.
  Utilizar versões stable disponíveis na inicialização.  
  Não utilizar versões beta/canary sem necessidade documentada.

## 67. SERVER VS CLIENT

Componentes devem ser Server Components por padrão.  
Utilizar Client Components somente quando necessário para:

- formulário;
- animação;
- interação;
- estado local;
- APIs exclusivas do navegador.
  Não transformar a aplicação inteira em client-side sem necessidade.

## 68. RENDERING

Preferir:  
Static Generation para:

- Home;
- soluções;
- Sobre;
- páginas legais.
  Static/Dynamic conforme conteúdo para:
- cases;
- insights.
  A maior parte do site deve funcionar sem dependência de runtime pesado.

## 69. IMAGENS

Utilizar otimização automática.  
Preferir:

- AVIF;
- WebP.
  Sempre definir dimensões.  
  Evitar CLS.  
  Lazy load abaixo da dobra.  
  Não lazy-load do LCP principal.  
  Não utilizar PNG grande sem necessidade.

## 70. PERFORMANCE BUDGET

Metas de experiência:  
LCP ≤ 2,5 s.  
INP ≤ 200 ms.  
CLS ≤ 0,1.  
Avaliação real deverá considerar percentil 75 após existir tráfego suficiente.  
Meta de laboratório antes do lançamento  
Lighthouse mobile:  
Performance ≥ 90  
Accessibility ≥ 95  
Best Practices ≥ 95  
SEO ≥ 95  
Evitar interpretar Lighthouse como substituto de dados reais de usuários.

## 71. REGRAS DE PERFORMANCE

Não carregar:

- bibliotecas enormes para uma animação;
- vídeo pesado no Hero;
- carrossel pesado sem necessidade;
- scripts externos antes de necessário;
- fontes excessivas.
  Evitar dependências duplicadas.  
  Utilizar code splitting.  
  Verificar bundle.

## 72. ANALYTICS E PERFORMANCE

Scripts de terceiros não devem comprometer Hero.  
Tags não essenciais deverão respeitar consentimento.  
Inicialização de analytics deverá ocorrer de forma controlada.

## 73. CONSENTIMENTO

Implementar gerenciamento de consentimento.  
Categorias:

- necessário;
- analytics;
- marketing.
  Usuário deve conseguir:
- aceitar;
- rejeitar;
- gerenciar;
- alterar posteriormente.
  Integração com Google Consent Mode.  
  Estados relevantes:
- analytics_storage;
- ad_storage;
- ad_user_data;
- ad_personalization.
  Política final deverá ser validada conforme orientação jurídica da empresa.

## 74. PRIVACIDADE

Criar páginas:  
/privacidade  
/cookies  
Formulário deve apresentar link para política.  
Não coletar dados sensíveis que não sejam necessários.  
Não enviar PII para analytics.

## 75. SEGURANÇA

Implementar:

- validação server-side;
- sanitização;
- rate limit;
- honeypot;
- anti-spam;
- CAPTCHA/Turnstile somente se necessário;
- HTTPS;
- proteção contra double-submit;
- limite de tamanho de payload;
- tratamento seguro de erros.
  Não expor stack traces ao visitante.

## 76. HEADERS

Avaliar e implementar:

- Content-Security-Policy;
- X-Content-Type-Options;
- Referrer-Policy;
- Permissions-Policy;
- Strict-Transport-Security quando apropriado ao ambiente.
  Testar CSP antes de enforcement definitivo para evitar quebrar tracking.

## 77. SECRETS

Nunca armazenar secrets em:

- repositório;
- código client;
- .env.example real;
- screenshot;
- documentação pública.
  Utilizar environment variables.  
  Commitar apenas nomes das variáveis.

## 78. ENVIRONMENT VARIABLES

Exemplo:  
NEXT_PUBLIC_SITE_URL

NEXT_PUBLIC_GTM_ID

NEXT_PUBLIC_META_PIXEL_ID

NEXT_PUBLIC_LINKEDIN_PARTNER_ID

CRM_PROVIDER  
CRM_WEBHOOK_URL  
CRM_API_KEY

LEADS_NOTIFICATION_EMAIL

EMAIL_PROVIDER_API_KEY

NEXT_PUBLIC_BOOKING_URL

NEXT_PUBLIC_TURNSTILE_SITE_KEY  
TURNSTILE_SECRET_KEY

SENTRY_DSN  
Adicionar somente variáveis realmente utilizadas.

## 79. OBSERVABILIDADE

Implementar logs para:

- erros de formulário;
- falhas de integração;
- exceptions server-side.
  Adicionar error monitoring se ferramenta for configurada.  
  Se utilizar Sentry ou equivalente:  
  não enviar PII desnecessária.

## 80. PÁGINA 404

Criar página própria.  
Copy:  
Parece que esta página não existe.  
CTA:  
Voltar para a Dreamy  
ou  
Conhecer nossas soluções  
Não utilizar 404 genérico do framework.

## 81. ERROR BOUNDARIES

Criar estados de erro apropriados.  
Não deixar páginas em branco em caso de falha.  
Fornecer fallback para conteúdo dinâmico quando aplicável.

## 82. CONTENT MODEL

Solution

- slug
- name
- eyebrow
- headline
- description
- problem
- capabilities
- process
- CTA
- SEO
  Case
- slug
- client
- sector
- summary
- problem
- solution
- result
- images
- metrics
- approved
- SEO
  Insight
- slug
- title
- description
- date
- updatedAt
- author
- content
- image
- SEO
- status

## 83. CASE VALIDATION

Adicionar campo:  
approved: true/false  
Cases não aprovados não entram no build público.  
Métricas devem ser opcionais.  
Não exigir métrica fictícia apenas para completar layout.

## 84. CONTEÚDO

V1 pode utilizar:  
MDX + conteúdo versionado no Git.  
Não adicionar CMS apenas para dizer que existe CMS.  
A arquitetura deverá permitir migração posterior.  
Possíveis CMS futuros:

- Sanity;
- Contentful;
- Payload;
- equivalente.
  Nenhuma dependência precisa ser adicionada agora.

## 85. INTERNACIONALIZAÇÃO FUTURA

V1:  
PT-BR.  
Não instalar biblioteca de i18n sem uso imediato.  
Entretanto:

- evitar lógica dependente de strings;
- não espalhar conteúdo de marketing dentro de componentes;
- manter arquitetura compatível com internacionalização futura.
  Possíveis idiomas:
- inglês;
- espanhol.

## 86. ESTRUTURA DE REPOSITÓRIO

/  
.agents/  
rules/  
dreamy-site.md

docs/  
PRD.md  
DECISIONS.md  
CONTENT-SOURCES.md  
TRACKING.md  
QA.md  
SEO-MIGRATION.md

src/  
app/  
page.tsx  
layout.tsx

      solucoes/
        page.tsx
        nova-receita-digital/
        sistemas-sob-medida/
        agentes-de-ia/

      cases/
        page.tsx
        [slug]/

      insights/
        page.tsx
        [slug]/

      sobre/
      contato/
      privacidade/
      cookies/

      not-found.tsx
      sitemap.ts
      robots.ts

      api/
        leads/

    components/
      ui/
      layout/
      marketing/
      forms/
      content/
      analytics/

    content/
      cases/
      insights/
      solutions/

    lib/
      analytics/
      crm/
      email/
      leads/
      seo/
      security/
      validation/

    styles/

public/  
brand/  
images/  
icons/

tests/  
unit/  
e2e/

## 87. REGRA DO WORKSPACE ANTIGRAVITY

Criar:  
.agents/rules/dreamy-site.md  
Configurar como regra Always On.  
Conteúdo mínimo da regra:  
Este projeto implementa o site institucional B2B da Dreamy.  
O arquivo docs/PRD.md é a fonte de verdade.  
Nunca invente clientes, métricas, depoimentos, cases ou resultados.  
Nunca reintroduza NoCode/LowCode como posicionamento público.  
Existem exatamente três soluções comerciais principais.  
Antes de adicionar dependência, avalie se existe solução nativa.  
Server Components são padrão.  
Preserve acessibilidade, SEO e performance.  
Toda alteração visual relevante deve ser testada em desktop e mobile.  
Não considere uma fase concluída sem build, testes e browser review.

## 88. DOCUMENTAÇÃO

Criar README completo com:

- projeto;
- requisitos;
- instalação;
- desenvolvimento;
- build;
- env vars;
- deploy;
- scripts;
- analytics;
- conteúdo;
- estrutura.
  Criar:  
  docs/DECISIONS.md  
  Formato:

# ADR-001

Decision:  
Use MDX for v1 content.

Reason:  
Small initial content volume.

Alternatives:  
Headless CMS.

Date:  
...

Status:  
Accepted.

## 89. TESTES

Unitários  
Testar principalmente:

- validation;
- scoring;
- analytics helpers;
- SEO helpers;
- lead transformation.
  Componentes  
  Testar componentes críticos:
- formulário;
- navigation;
- accordion.
  E2E  
  Utilizar Playwright ou equivalente.  
  Fluxos:  
  Home → Solution  
  Solution → Contact  
  Contact → Success  
  Validation Error  
  Mobile Menu  
  404

## 90. QA VISUAL

Após cada grande fase:  
capturar screenshots em:  
390 px;  
768 px;  
1440 px.  
Comparar:

- alinhamentos;
- quebras;
- overflow;
- contraste;
- legibilidade;
- espaços;
- loading.
  Antigravity deve utilizar browser para verificar resultado real.  
  Não considerar apenas código.

## 91. BROWSERS

Suportar versões modernas de:

- Chrome;
- Edge;
- Firefox;
- Safari;
- iOS Safari;
- Android Chrome.
  Não adicionar polyfills excessivos para browsers obsoletos.

## 92. QA DE FORMULÁRIO

Testar:

- e-mail válido;
- e-mail inválido;
- telefone;
- campos vazios;
- texto longo;
- spam;
- double-click;
- refresh;
- timeout;
- integração indisponível;
- conexão lenta;
- mobile keyboard.

## 93. QA DE SEO

Validar:

- H1;
- title;
- description;
- canonical;
- sitemap;
- robots;
- OG;
- favicon;
- structured data;
- 404;
- redirects;
- noindex de preview.

## 94. QA DE ANALYTICS

Validar individualmente:

- page_view;
- CTA;
- solution;
- form_start;
- form_step;
- generate_lead;
- booking.
  Garantir ausência de PII.  
  Evitar eventos duplicados.

## 95. PERFORMANCE QA

Executar:

- Lighthouse;
- bundle analysis quando necessário;
- network waterfall;
- throttling mobile.
  Investigar:
- hero;
- fonts;
- images;
- third-party scripts;
- JS hydration.

## 96. FASES DE DESENVOLVIMENTO

FASE 0 — AUDIT & FOUNDATION  
Antes de implementar.  
Entregáveis:

- screenshots do site atual;
- inventário;
- URL map inicial;
- arquitetura;
- implementation plan;
- estrutura do repo;
- design tokens;
- workspace rule.
  Gate:  
  não iniciar UI antes dessa fase.

## 97. FASE 1 — DESIGN SYSTEM

Criar:

- cores;
- typography;
- buttons;
- inputs;
- cards;
- spacing;
- layout;
- motion tokens.
  Construir pequena página interna temporária para revisão visual dos componentes, se útil.  
  Gate:  
  desktop + mobile validados.

## 98. FASE 2 — HOME

Implementar integralmente:

- Header;
- Hero;
- proof;
- problema;
- soluções;
- diagnóstico;
- cases;
- processo;
- ICP/Fit;
- FAQ;
- CTA;
- Footer.
  Gate:  
  browser review + screenshot + mobile.

## 99. FASE 3 — SOLUÇÕES

Implementar:

- Nova Receita Digital;
- Sistemas Sob Medida;
- Agentes de IA.
  Gate:  
  copy correta.  
  CTAs corretos.  
  Metadata.  
  Responsive.

## 100. FASE 4 — INSTITUCIONAL

Implementar:

- Sobre;
- Cases;
- Case template;
- Insights se aplicável;
- políticas;
- -

## 101. FASE 5 — CONVERSÃO

Implementar:

- formulário;
- validação;
- lead scoring;
- CRM adapter;
- e-mail;
- UTMs;
- booking;
- anti-spam.
  Não avançar até formulário realmente funcionar.

## 102. FASE 6 — MEASUREMENT

Implementar:

- GTM;
- GA4;
- LinkedIn;
- Meta;
- Consent Mode;
- eventos;
- conversões.
  Criar documentação de tracking.

## 103. FASE 7 — HARDENING

Executar:

- testes;
- segurança;
- SEO;
- acessibilidade;
- performance;
- responsividade;
- browser compatibility.

## 104. FASE 8 — MIGRAÇÃO

Executar:

- redirect map;
- domínio;
- produção;
- sitemap;
- Search Console;
- analytics validation;
- DNS.

## 105. FASE 9 — PÓS-LANÇAMENTO

Monitorar:

- erros;
- leads;
- analytics;
- páginas 404;
- Search Console;
- performance real;
- eventos;
- conversão.
  Não considerar a migração encerrada no momento do deploy.

## 106. DEFINITION OF DONE POR FASE

Uma fase só está concluída quando:  
Código

- build funciona;
- lint funciona;
- testes relevantes passam;
- console não contém erro crítico.
  Visual
- desktop revisado;
- mobile revisado;
- screenshots gerados.
  UX
- navegação funciona;
- estados existem;
- teclado funciona.
  Conteúdo
- sem placeholder;
- sem lorem ipsum;
- sem métricas inventadas.
  Técnico
- SEO válido;
- analytics aplicável validado;
- performance revisada.

## 107. CRITÉRIOS DE ACEITE FINAL

O projeto somente poderá ir para produção quando:

- o Hero explicar o negócio claramente;
- existirem apenas três ofertas centrais;
- NoCode/LowCode não aparecer como posicionamento;
- depoimentos estiverem totalmente removidos;
- nenhum dado fictício estiver publicado;
- nenhum logo não autorizado estiver publicado;
- formulário funcionar;
- leads chegarem corretamente;
- UTMs forem preservadas;
- analytics estiver funcionando;
- PII não estiver indo para analytics;
- GTM não gerar eventos duplicados;
- cookies respeitarem consentimento;
- structured data estiver válido;
- metadata existir;
- sitemap existir;
- robots estiver correto;
- previews estiverem noindex;
- redirects estiverem definidos;
- página 404 existir;
- mobile estiver validado;
- teclado funcionar;
- Lighthouse atender metas estabelecidas;
- não houver secrets no repositório;
- documentação estiver atualizada.

## 108. CHECKLIST DE LANÇAMENTO

Conteúdo

- Copy final revisada
- Cases aprovados
- Logos autorizados
- Métricas comprovadas
- Contatos corretos
- Políticas revisadas
  SEO
- Titles
- Descriptions
- Canonicals
- Sitemap
- Robots
- Structured data
- OG images
- Redirects
- Search Console
  Conversão
- Formulário
- CRM
- E-mail
- Booking
- UTM
- Lead scoring
  Analytics
- GTM
- GA4
- Meta
- LinkedIn
- Consent
- Eventos
- Conversões
  Qualidade
- Lighthouse
- Mobile
- Desktop
- Safari
- Chrome
- Keyboard
- Accessibility
- Links
- 404
- Security

## 109. ITENS QUE DEVEM SER CONFIGURÁVEIS

Não bloquear desenvolvimento esperando essas decisões.  
Criar placeholders de configuração claramente identificados para:

- CRM escolhido;
- e-mail de lead;
- ferramenta de agendamento;
- IDs GA4/GTM;
- Meta Pixel;
- LinkedIn Partner ID;
- cases autorizados;
- métricas verificadas;
- CNPJ/dados jurídicos;
- canal de contato;
- ferramenta de error monitoring.
  Não inventar valores.

## 110. MELHORIAS FUTURAS — V1.1

Após tráfego real:

- testes A/B do Hero;
- otimização do formulário;
- melhoria do lead scoring;
- landing pages por setor;
- conteúdo SEO;
- case studies adicionais;
- tracking server-side;
- conversion APIs;
- integração CRM mais profunda;
- automações comerciais.

## 111. MELHORIAS FUTURAS — V2

Possibilidades:

- site EN;
- site ES;
- CMS;
- personalização por segmento;
- biblioteca de cases;
- conteúdo técnico;
- ferramenta de diagnóstico;
- calculadora de oportunidade;
- área de conteúdos executivos;
- automações pós-lead.
  Não implementar antecipadamente.

## 112. MÉTRICA NORTE

O KPI principal do site não será:

- sessões;
- tempo na página;
- likes;
- scroll.
  Será:  
  Reuniões qualificadas geradas pelo site.  
  Métricas auxiliares:  
  Visitante  
  → CTA  
  → form start  
  → form complete  
  → lead qualificado  
  → reunião  
  → oportunidade  
  → venda.  
  Sempre que possível, evoluir mensuração até receita originada.

## 113. PRINCÍPIO FINAL

O objetivo do site não é demonstrar tudo que a Dreamy sabe fazer.  
O objetivo é fazer um empresário pensar:  
“Eles entenderiam um problema importante da minha empresa e conseguiriam construir algo para resolvê-lo.”  
Se o site transmitir isso, ele cumpriu sua função.  
Se transmitir apenas:  
“eles sabem programar e trabalhar com IA”,  
o posicionamento ainda não está correto.

## 114. INSTRUÇÃO FINAL AO AGENTE ANTIGRAVITY

Ao receber este PRD:  
Não comece programando.  
Primeiro:

- analise o documento;
- analise o site atual;
- crie o mapa do projeto;
- identifique riscos;
- proponha arquitetura;
- crie Design System;
- produza Implementation Plan;
- valide consistência entre estratégia, conteúdo e arquitetura.
  Durante o desenvolvimento:  
  Não improvise claims comerciais.  
  Não adicione features fora do escopo.  
  Não sacrifique performance para criar animações.  
  Não transforme todas as seções em cards iguais.  
  Não transforme a Dreamy em uma agência genérica de IA.  
  Não publique placeholders.  
  Utilize browser continuamente para verificar aquilo que está sendo construído.  
  Ao finalizar cada grande etapa, produzir:
- resumo do que foi implementado;
- arquivos alterados;
- testes realizados;
- pendências;
- screenshots mobile;
- screenshots desktop.
  A implementação final precisa parecer um produto digital premium, não apenas um site tecnicamente correto.

## 115. REFERÊNCIAS TÉCNICAS DO PRD

O fluxo recomendado para o Antigravity utiliza recursos atuais de Projects, Planning Mode, Artifacts, workspace Rules, browser e screenshots.  
O Next.js atual possui APIs nativas para metadata e imagens sociais, incluindo metadata estática, generateMetadata e convenções próprias de arquivos.  
As metas de Core Web Vitals utilizadas neste PRD seguem os parâmetros de LCP até 2,5 s, INP até 200 ms e CLS até 0,1, avaliados no percentil 75 para a experiência real dos usuários.  
A implementação de consentimento deverá definir estados padrão e atualizá-los após a escolha do usuário, incluindo os parâmetros adicionais de Consent Mode v2.
