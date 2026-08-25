"""Gera o PPTX da apresentação Dreamy (slides PNG 2x + notas do apresentador)
e o ROTEIRO.md de ensaio a partir da mesma fonte (lista NOTES abaixo).

Uso: python scripts/dev/build-deck-pptx.py <pasta-com-slide-XX.png>
(shots: pnpm tsx scripts/dev/deck-shots.ts docs/apresentacao/dreamy-apresentacao.html <pasta> 2)
Requer: pip install python-pptx
"""

import glob
import io
import os
import sys

from pptx import Presentation
from pptx.util import Emu

SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
OUT_PPTX = "docs/apresentacao/Dreamy — Apresentação Institucional.pptx"
OUT_MD = "docs/apresentacao/ROTEIRO.md"

# (título do slide, objetivo + tempo, fala)
NOTES = [
    (
        "Capa — Tecnologia sob medida",
        "Objetivo: quebrar o gelo e fazer a promessa da conversa. ≈ 40s",
        "Obrigado pelo tempo de vocês. Eu sou [seu nome], da Dreamy.\n\n"
        "Antes de qualquer slide bonito, uma promessa: nos próximos dez minutos eu não vou falar de tecnologia pela tecnologia. Eu vou falar do negócio de vocês — de onde ele trava hoje e de onde ele pode ganhar mais.\n\n"
        "A Dreamy constrói software sob medida e agentes de IA. Mas o nosso ponto de partida é sempre o mesmo, e está aí embaixo no slide: começamos pelo problema. A tecnologia vem depois.",
    ),
    (
        "Por que agora",
        "Urgência com dados de mercado — deixe os números falarem e não se alongue. ≈ 40s",
        "Antes de falar da Dreamy, trinta segundos sobre o momento.\n\n"
        "88% das empresas no mundo já usam IA em pelo menos uma função — eram 78% há um ano. "
        "Só em 2024, foram 252 bilhões de dólares investidos em IA. E quem investe está tendo retorno: "
        "em média, 3,7 dólares de volta para cada 1 investido.\n\n"
        "[pausa curta]\n\n"
        "Ou seja: a pergunta deixou de ser SE vale a pena. A pergunta agora é ONDE — no seu negócio. "
        "E é exatamente isso que a gente veio responder.",
    ),
    (
        "O problema",
        "Objetivo: gerar identificação — a plateia precisa se reconhecer na cena. ≈ 60s",
        "Deixa eu descrever uma empresa, e você me diz se soa familiar.\n\n"
        "A empresa cresce. Os processos vão ficando cada vez mais específicos. Os sistemas param de conversar entre si. Alguma planilha — geralmente uma que só uma pessoa entende — passa a sustentar decisões importantes. E lá no comercial, leads esfriam sem ninguém perceber.\n\n"
        "[pausa — deixe a cena assentar]\n\n"
        "Nada disso é falta de competência. É que a empresa cresceu mais rápido do que a tecnologia dela. E software pronto, de prateleira, não foi feito para o SEU processo — foi feito para a média.",
    ),
    (
        "É nesse ponto que entramos",
        "Objetivo: a virada. Slide quase vazio de propósito — a força está na pausa. ≈ 15s",
        "E é exatamente nesse ponto que a gente entra.\n\n"
        "[pausa longa — não corra este slide]\n\n"
        "Quando o software pronto acaba e o seu problema continua — esse é o nosso território.",
    ),
    (
        "Diagnóstico",
        "Objetivo: remover a maior objeção ('não sei o que pedir') e mostrar honestidade. ≈ 50s",
        "Uma coisa importante: você não precisa chegar para a gente sabendo o que construir.\n\n"
        "Nenhum cliente nosso chegou com uma especificação técnica. Eles chegam com uma dor: \"isso aqui demora demais\", \"estou desperdiçando oportunidade comercial\", \"não consigo enxergar a minha operação\".\n\n"
        "O nosso trabalho começa aí — nessa régua do slide: entender a dor, medir o impacto, achar a oportunidade, desenhar a solução, e só então escolher a tecnologia. E às vezes a resposta honesta do diagnóstico é: não vale a pena construir nada. Essa honestidade faz parte do serviço — ninguém aqui quer vender software que não devolve resultado.",
    ),
    (
        "As três soluções",
        "Objetivo: dar o mapa da conversa e convidar a interrupção (engajamento). ≈ 40s",
        "Na prática, o que a gente constrói se organiza em três frentes.\n\n"
        "Um: receita nova — transformar o que a empresa já tem em um produto digital que os clientes dela pagariam para usar. Dois: operação — sistemas construídos em volta do seu processo, e não o contrário. Três: agentes de IA — colocar a IA para executar trabalho de verdade dentro da empresa.\n\n"
        "Vou passar rápido pelas três. E pode me interromper na hora em que alguma fizer clique com algo que vocês vivem aí dentro — essa é a parte boa da conversa.",
    ),
    (
        "01 · Nova Receita Digital",
        "Objetivo: plantar a pergunta que fica na cabeça depois da reunião. ≈ 60s",
        "Primeira frente.\n\n"
        "A sua empresa já conquistou o mais difícil: clientes, confiança, conhecimento, distribuição. Isso levou anos. A pergunta que a gente faz é: o que MAIS essas pessoas comprariam de você?\n\n"
        "Pode ser um portal, uma assinatura, uma ferramenta que resolve uma dor do seu cliente. Cada produto nasce da base que já existe — por isso esse gráfico é conceitual, sem números: os números vêm do diagnóstico, do SEU caso, não de uma promessa genérica minha.\n\n"
        "Mas leva essa pergunta para casa: se uma parte dos seus clientes pagasse por um novo produto digital seu... o que valeria a pena construir?",
    ),
    (
        "02 · Sistemas Sob Medida",
        "Objetivo: inverter a lógica 'empresa se adapta ao software' e reforçar a parceria. ≈ 50s",
        "Segunda frente.\n\n"
        "Hoje, a informação da sua operação mora em lugares demais — está aí no slide: planilha, ERP, e-mail, documento... e na cabeça de gente boa. Software genérico obriga a SUA empresa a se adaptar a ELE. A gente inverte isso: constrói o sistema em volta do seu processo.\n\n"
        "O resultado é um lugar só, com a informação consolidada — e decisão com visibilidade, não no feeling.\n\n"
        "E vale repetir: você não precisa trazer a solução pronta. Você conhece o seu negócio; nós conhecemos tecnologia. O desenho a gente faz junto.",
    ),
    (
        "03 · Agentes de IA",
        "Objetivo: desfazer o mal-entendido 'agente = chatbot' e tranquilizar sobre controle. ≈ 50s",
        "Terceira frente — e aqui eu preciso desfazer um mal-entendido.\n\n"
        "Agente de IA não é chatbot. É software que executa etapas de um processo: interpreta informação, acessa as ferramentas que VOCÊ autorizar — CRM, ERP, WhatsApp, e-mail, documentos — e faz o trabalho.\n\n"
        "Com escopo definido, com regras, com permissões. E quando o assunto precisa de gente, ele passa para gente — está aí na saída de baixo do diagrama.\n\n"
        "Autonomia com controle. Sempre nessa ordem.",
    ),
    (
        "Onde os agentes atuam",
        "Objetivo: tornar concreto — três cenas do dia a dia que a plateia reconhece. ≈ 50s",
        "Três lugares onde isso fica concreto.\n\n"
        "No atendimento: o agente responde, consulta as informações, registra tudo no CRM — e chama um humano quando a conversa pede um humano.\n\n"
        "Em vendas: ele pesquisa o lead, qualifica, prepara o follow-up — o vendedor chega na conversa pronto, em vez de gastar a manhã pesquisando.\n\n"
        "Na operação: ele lê sistemas e documentos, consolida, analisa e age.\n\n"
        "Repara no padrão das três colunas: o agente fica com o trabalho repetitivo; as pessoas ficam com o que exige gente.",
    ),
    (
        "Como trabalhamos",
        "Objetivo: reduzir o risco percebido — processo claro, ciclos curtos, sem sumiço. ≈ 45s",
        "E como é trabalhar com a gente? Cinco passos, sem mistério.\n\n"
        "Entender: a gente senta junto e mapeia problema, impacto e contexto. Desenhar: solução, experiência, arquitetura. Construir: em ciclos curtos — você vê o software crescendo e valida no caminho; a gente não some seis meses para voltar com uma surpresa. Implantar: na operação real, com quem usa de verdade. E evoluir: porque software bom não termina — acompanha o negócio.\n\n"
        "Em cada ciclo você sabe o que está sendo feito, por quê, e o que vem depois.",
    ),
    (
        "Para quem",
        "Objetivo: qualificar com franqueza — quem tem fit se reconhece e se inclina. ≈ 40s",
        "Sendo bem direto sobre para quem isso funciona: o nosso trabalho rende mais em empresa que já funciona.\n\n"
        "Que já tem operação, clientes, time — e sente que a tecnologia virou o freio, e não o motor.\n\n"
        "Se, enquanto eu falava, você lembrou de um processo que não escala, de sistemas que não conversam, de dados espalhados por aí... provavelmente existe algo que a gente pode construir juntos.",
    ),
    (
        "Fechamento",
        "Objetivo: uma única pergunta + próximo passo simples. Termine e deixe a plateia falar. ≈ 40s",
        "Então eu fecho com a única pergunta que importa hoje:\n\n"
        "qual problema da SUA empresa valeria a pena resolver agora?\n\n"
        "[pausa — deixe alguém responder; se ninguém responder, chame pelo nome quem demonstrou mais interesse]\n\n"
        "Não precisa ser a resposta perfeita. Me conta o contexto, e a gente avalia junto se existe uma solução com impacto de verdade — inclusive se a resposta for \"ainda não\".\n\n"
        "O próximo passo é simples: uma conversa. O WhatsApp está aí no slide. E como diz o nosso site: sem apresentação genérica — na próxima conversa, o assunto é o seu negócio.\n\n"
        "Obrigado!",
    ),
]

def main():
    files = sorted(glob.glob(os.path.join(SHOTS, "slide-*.png")))
    assert len(files) == len(NOTES), (len(files), len(NOTES))
    
    # --- PPTX ---------------------------------------------------------------
    prs = Presentation()
    prs.slide_width = Emu(12192000)   # 13,333 in — 16:9
    prs.slide_height = Emu(6858000)  # 7,5 in
    blank = prs.slide_layouts[6]
    
    for png, (title, goal, speech) in zip(files, NOTES):
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(png, 0, 0, width=prs.slide_width, height=prs.slide_height)
        slide.notes_slide.notes_text_frame.text = f"{goal}\n\n{speech}"
    
    prs.core_properties.title = "Dreamy — Apresentação Institucional"
    prs.core_properties.author = "Dreamy"
    prs.core_properties.comments = "Pitch de palco — 12 slides. Fala completa nas notas do apresentador."
    prs.save(OUT_PPTX)
    print("PPTX salvo:", OUT_PPTX, os.path.getsize(OUT_PPTX), "bytes")
    
    # --- ROTEIRO.md ----------------------------------------------------------
    md = io.StringIO()
    md.write("# Roteiro do pitch — Dreamy (12 slides, ≈ 9 min)\n\n")
    md.write(
        "A mesma fala está nas notas do apresentador do PPTX (visão do apresentador no PowerPoint: `Alt+F5`).\n"
        "Substitua `[seu nome]` e ensaie as pausas marcadas — elas fazem parte do pitch.\n"
        "Copy fiel ao PRD/site: sem métricas, clientes ou cases inventados (PRD §2).\n\n"
    )
    for i, (title, goal, speech) in enumerate(NOTES, 1):
        md.write(f"## Slide {i:02d} — {title}\n\n")
        md.write(f"_{goal}_\n\n")
        for par in speech.split("\n\n"):
            md.write(f"> {par}\n\n" if par.startswith("[") else f"{par}\n\n")
    with open(OUT_MD, "w", encoding="utf-8", newline="\n") as f:
        f.write(md.getvalue())
    print("Roteiro salvo:", OUT_MD)


if __name__ == "__main__":
    main()
