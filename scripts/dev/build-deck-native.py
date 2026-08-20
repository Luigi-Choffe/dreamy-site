"""Gera a versão NATIVA (editável) da apresentação Dreamy dirigindo o PowerPoint via COM.

Textos e formas reais (nada de imagem), diagramas em shapes/beziers, animações de
entrada (fade escalonado), transições suaves, notas do apresentador (roteiro do
pitch, importado de build-deck-pptx.py) e fontes da marca embutidas no arquivo.

Uso:    python scripts/dev/build-deck-native.py [pasta-shots-de-revisão]
Saída:  docs/apresentacao/Dreamy — Apresentação Institucional (editável).pptx
Requer: Windows + PowerPoint instalado + pip install pywin32
        Fontes "Urbanist" (Bold) e "Instrument Sans Medium" instaladas
        (conversão das WOFFs de src/assets/fonts — ver docs/apresentacao/README.md).
"""

import importlib.util
import os
import sys

import win32com.client as win32
from win32com.client import gencache

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "apresentacao", "Dreamy — Apresentação Institucional (editável).pptx")
LOGO = os.path.join(ROOT, "public", "brand", "dreamy-logo-dark-bg.png")
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None

# roteiro de fala (fonte única)
spec = importlib.util.spec_from_file_location("deck_notes", os.path.join(ROOT, "scripts", "dev", "build-deck-pptx.py"))
_mod = importlib.util.module_from_spec(spec)
_mod.__dict__["__name__"] = "deck_notes"
try:
    spec.loader.exec_module(_mod)
except SystemExit:
    pass
except Exception:
    pass
NOTES = _mod.NOTES

# --- paleta (RGB → int BGR do COM) -----------------------------------------
def C(hexstr):
    r, g, b = int(hexstr[0:2], 16), int(hexstr[2:4], 16), int(hexstr[4:6], 16)
    return r + g * 256 + b * 65536

INK = C("0B0B0C")
INK2 = C("131316")
PAPER = C("F7F8F8")
GREEN = C("46EB7E")
GREEN_DEEP = C("0F7C47")
MUT_D = C("9BA1A6")
MUT_L = C("575C61")
LIGHT = C("E8EAEC")
WHITE = C("FFFFFF")
BLACK_INK = C("0B0B0C")
HUB = C("101711")

DISPLAY = "Urbanist"
SANS = "Instrument Sans Medium"

app = gencache.EnsureDispatch("PowerPoint.Application")
_RAW_K = win32.constants


class _K:
    """Constantes Office com fallback numérico (nem toda enum Mso entra no proxy)."""

    _defaults = {
        "msoLineDash": 4,
        "msoAnimEffectFade": 10,
        "msoAnimEffectWipe": 22,
        "msoAnimDirectionLeft": 4,
        "msoAnimTriggerWithPrevious": 2,
        "ppEffectFadeSmoothly": 3849,
    }

    def __getattr__(self, name):
        try:
            return getattr(_RAW_K, name)
        except AttributeError:
            return self._defaults[name]


K = _K()
pres = app.Presentations.Add(WithWindow=False)
pres.PageSetup.SlideWidth = 960
pres.PageSetup.SlideHeight = 540

MARGIN = 54


def slide_new(dark=True):
    s = pres.Slides.Add(pres.Slides.Count + 1, 12)  # ppLayoutBlank
    s.FollowMasterBackground = False
    s.Background.Fill.ForeColor.RGB = INK if dark else PAPER
    return s


def txt(s, x, y, w, h, text, font=SANS, size=12, color=WHITE, bold=False, spacing=0.0,
        align="l", line=None, accents=None, anchor_bottom=False):
    box = s.Shapes.AddTextbox(1, x, y, w, h)
    tf = box.TextFrame2
    tf.WordWrap = True
    tf.AutoSize = 0
    tf.MarginLeft = tf.MarginRight = tf.MarginTop = tf.MarginBottom = 0
    if anchor_bottom:
        tf.VerticalAnchor = 4  # msoAnchorBottom
    tr = tf.TextRange
    tr.Text = text
    f = tr.Font
    f.Name = font
    f.Size = size
    f.Bold = bold
    f.Spacing = spacing
    f.Fill.ForeColor.RGB = color
    pf = tr.ParagraphFormat
    pf.Alignment = {"l": 1, "c": 2, "r": 3}[align]
    pf.LineRuleWithin = True
    pf.SpaceWithin = line if line is not None else (0.9 if font == DISPLAY else 1.04)
    for (sub, col) in (accents or []):
        start = text.find(sub)
        if start >= 0:
            box.TextFrame.TextRange.Characters(start + 1, len(sub)).Font.Color.RGB = col
    return box


def eyebrow(s, text, y=45, color=GREEN, x=MARGIN, w=400):
    return txt(s, x, y, w, 16, text.upper(), SANS, 10, color, spacing=1.7)


def rect(s, x, y, w, h, fill=None, fill_t=0.0, line_color=None, line_t=0.0, line_w=1.0, round_=None):
    shape = s.Shapes.AddShape(5 if round_ is not None else 1, x, y, w, h)
    if round_ is not None:
        shape.Adjustments.SetItem(1, round_)
    if fill is None:
        shape.Fill.Visible = False
    else:
        shape.Fill.ForeColor.RGB = fill
        shape.Fill.Transparency = fill_t
    if line_color is None:
        shape.Line.Visible = False
    else:
        shape.Line.ForeColor.RGB = line_color
        shape.Line.Transparency = line_t
        shape.Line.Weight = line_w
    shape.Shadow.Visible = False
    return shape


def oval(s, cx, cy, r, fill=None, fill_t=0.0, line_color=None, line_t=0.0, line_w=1.0, rx=None, ry=None):
    rx = rx or r
    ry = ry or r
    shape = s.Shapes.AddShape(9, cx - rx, cy - ry, rx * 2, ry * 2)
    if fill is None:
        shape.Fill.Visible = False
    else:
        shape.Fill.ForeColor.RGB = fill
        shape.Fill.Transparency = fill_t
    if line_color is None:
        shape.Line.Visible = False
    else:
        shape.Line.ForeColor.RGB = line_color
        shape.Line.Transparency = line_t
        shape.Line.Weight = line_w
    shape.Shadow.Visible = False
    return shape


def line(s, x1, y1, x2, y2, color=WHITE, t=0.86, w=1.1, dash=None):
    shape = s.Shapes.AddLine(x1, y1, x2, y2)
    shape.Line.ForeColor.RGB = color
    shape.Line.Transparency = t
    shape.Line.Weight = w
    if dash:
        shape.Line.DashStyle = dash
    shape.Shadow.Visible = False
    return shape


def pill(s, x, y, w, h, text, fill=INK2, fill_t=0.0, line_color=WHITE, line_t=0.8,
         text_color=LIGHT, size=11, font=SANS, bold=False, sub=None):
    shape = rect(s, x, y, w, h, fill, fill_t, line_color, line_t, 1.0, round_=0.5)
    tf = shape.TextFrame2
    tf.MarginLeft = tf.MarginRight = 4
    tf.MarginTop = tf.MarginBottom = 0
    tf.WordWrap = False
    tf.AutoSize = 0
    tr = tf.TextRange
    tr.Text = text
    tr.Font.Name = font
    tr.Font.Size = size
    tr.Font.Bold = bold
    tr.Font.Fill.ForeColor.RGB = text_color
    tr.ParagraphFormat.Alignment = 2
    return shape


def bezier(s, pts, color=GREEN, t=0.0, w=2.0, fill=None, fill_t=0.0, close_to=None):
    """pts = [(x,y), (c1,c1y,c2x,c2y,x,y), ...]; close_to = lista de vértices em linha reta para fechar área."""
    fb = s.Shapes.BuildFreeform(1, pts[0][0], pts[0][1])
    for seg in pts[1:]:
        if len(seg) == 6:
            fb.AddNodes(1, 1, seg[0], seg[1], seg[2], seg[3], seg[4], seg[5])
        else:
            fb.AddNodes(0, 1, seg[0], seg[1])
    if close_to:
        for (px_, py_) in close_to:
            fb.AddNodes(0, 1, px_, py_)
    shape = fb.ConvertToShape()
    if fill is None:
        shape.Fill.Visible = False
    else:
        shape.Fill.ForeColor.RGB = fill
        shape.Fill.Transparency = fill_t
    if color is None:
        shape.Line.Visible = False
    else:
        shape.Line.ForeColor.RGB = color
        shape.Line.Transparency = t
        shape.Line.Weight = w
    shape.Shadow.Visible = False
    return shape


def group(s, shapes):
    if len(shapes) == 1:
        return shapes[0]
    names = [sh.Name for sh in shapes]
    import pythoncom
    from win32com.client import VARIANT
    arr = VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_VARIANT, names)
    return s.Shapes.Range(arr).Group()


def fade(s, shape, delay, dur=0.45, effect=None, direction=None):
    eff = s.TimeLine.MainSequence.AddEffect(shape, effect or K.msoAnimEffectFade, 0, K.msoAnimTriggerWithPrevious)
    eff.Timing.Duration = dur
    eff.Timing.TriggerDelayTime = delay
    if direction is not None:
        eff.EffectParameters.Direction = direction
    return eff


def progress(s, n, dark=True):
    total = 12
    track_l, track_r = MARGIN, 853
    y = 518
    col = GREEN if dark else GREEN_DEEP
    base = WHITE if dark else C("0B0B0C")
    fill_w = (track_r - track_l) * n / total
    line(s, track_l, y, track_r, y, base, 0.86, 1.5)
    line(s, track_l, y, track_l + fill_w, y, col, 0.0, 1.5)
    oval(s, track_l + fill_w, y, 4, fill=col)
    txt(s, 862, y - 6, 44, 12, f"{n:02d} / {total}", SANS, 8.5, MUT_D if dark else MUT_L, spacing=0.8, align="r")


def discs(s, cx, cy, radii, alphas):
    return [oval(s, cx, cy, r, fill=GREEN, fill_t=1 - a) for r, a in zip(radii, alphas)]


def notes(s, i):
    title, goal, speech = NOTES[i]
    ns = s.NotesPage.Shapes.Placeholders(2)
    ns.TextFrame.TextRange.Text = f"{goal}\n\n{speech}"


def transition(s):
    s.SlideShowTransition.EntryEffect = K.ppEffectFadeSmoothly
    try:
        s.SlideShowTransition.Duration = 0.6
    except Exception:
        pass


# ============================================================ S1 · capa
s = slide_new()
discs(s, 862, 112, [225, 157, 90], [0.05, 0.06, 0.07])
logo = s.Shapes.AddPicture(LOGO, False, True, MARGIN, 42, -1, -1)
logo.Height = 24
ey = eyebrow(s, "Software + Inteligência Artificial", y=140)
h1 = txt(s, MARGIN, 150, 470, 250, "Tecnologia sobmedida paraganhar mais eoperar melhor.",
         DISPLAY, 52, WHITE, bold=True, spacing=-1.5, accents=[("ganhar mais", GREEN)])
mic = txt(s, MARGIN, 428, 400, 20, "Começamos pelo problema. A tecnologia vem depois.", SANS, 12, MUT_D)
# sistema vivo
ocx, ocy, R = 725, 262, 150
orb = []
orb.append(oval(s, ocx, ocy, R, line_color=WHITE, line_t=0.8, line_w=1.5))
orb.append(oval(s, ocx, ocy, 112, fill=GREEN, fill_t=0.95))
orb.append(oval(s, ocx, ocy, 78, fill=GREEN, fill_t=0.93))
import math
nodes = [("Clientes", 90, False), ("Dados", 30, False), ("IA", -30, True),
         ("Operação", -90, False), ("Receita", 150, True), ("Sistemas", 210, False)]
for name, ang, acc in nodes:
    nx = ocx + R * math.cos(math.radians(ang))
    ny = ocy - R * math.sin(math.radians(ang))
    orb.append(line(s, ocx, ocy, nx, ny, WHITE, 0.72, 1.4))
for name, ang, acc in nodes:
    nx = ocx + R * math.cos(math.radians(ang))
    ny = ocy - R * math.sin(math.radians(ang))
    w = 64 if len(name) <= 6 else 74
    orb.append(pill(s, nx - w / 2, ny - 13, w, 26, name,
                    fill=GREEN if acc else INK2, line_color=None if acc else WHITE,
                    line_t=0.78, text_color=BLACK_INK if acc else LIGHT, size=10))
orb.append(oval(s, ocx, ocy, 50, fill=INK, line_color=GREEN, line_w=1.5))
core = txt(s, ocx - 40, ocy - 14, 80, 28, "Sua\nempresa", SANS, 10.5, WHITE, align="c", line=1.1)
orb.append(core)
og = group(s, orb)
progress(s, 1)
fade(s, ey, 0.0)
fade(s, h1, 0.15, 0.55)
fade(s, mic, 0.45)
fade(s, og, 0.55, 0.7)
transition(s)
notes(s, 0)

# ============================================================ S2 · problema
s = slide_new()
ey = eyebrow(s, "O problema")
h1 = txt(s, MARGIN, 155, 470, 230, "Nem todo problema da sua empresa cabe em um software pronto.",
         DISPLAY, 48, WHITE, bold=True, spacing=-1.4, accents=[("software pronto.", MUT_D)])
fx, fy = 520, 130
dg = []
dg.append(line(s, fx + 96, fy + 72, fx + 231, fy + 141, dash=K.msoLineDash))
dg.append(line(s, fx + 231, fy + 141, fx + 126, fy + 231, dash=K.msoLineDash))
dg.append(line(s, fx + 126, fy + 231, fx + 193, fy + 298, dash=K.msoLineDash))
dg.append(line(s, fx + 300, fy + 72, fx + 231, fy + 141, dash=K.msoLineDash))
dg.append(line(s, fx + 30, fy + 160, fx + 96, fy + 72, dash=K.msoLineDash))
dg.append(line(s, fx + 300, fy + 72, fx + 337, fy + 208, dash=K.msoLineDash))
dg.append(line(s, fx + 243, fy + 231, fx + 337, fy + 208, dash=K.msoLineDash))
dg.append(pill(s, fx + 1, fy + 55, 200, 33, "Sistemas que não conversam", size=11))
dg.append(pill(s, fx + 233, fy + 124, 135, 33, "Trabalho manual", size=11))
dg.append(pill(s, fx + 176, fy + 214, 136, 33, "Planilhas críticas", size=11))
dg.append(pill(s, fx + 96, fy + 282, 192, 33, "Leads sem acompanhamento", size=11))
for (dx, dy) in [(30, 160), (337, 208), (82, 6), (307, 6), (360, 313), (12, 246)]:
    dg.append(oval(s, fx + dx, fy + dy, 3.5, fill=WHITE, fill_t=0.68))
dgg = group(s, dg)
progress(s, 2)
fade(s, ey, 0.0)
fade(s, h1, 0.15, 0.55)
fade(s, dgg, 0.5, 0.7)
transition(s)
notes(s, 1)

# ============================================================ S3 · punchline
s = slide_new()
discs(s, 105, 465, [262, 180, 105], [0.06, 0.07, 0.08])
h1 = txt(s, MARGIN, 200, 810, 220, "É nesse ponto que entramos.",
         DISPLAY, 92, WHITE, bold=True, spacing=-2.7, accents=[("entramos.", GREEN)])
progress(s, 3)
fade(s, h1, 0.25, 0.8)
transition(s)
notes(s, 2)

# ============================================================ S4 · diagnóstico (claro)
s = slide_new(dark=False)
ey = eyebrow(s, "Diagnóstico", color=GREEN_DEEP)
h1 = txt(s, MARGIN, 76, 690, 120, "Você não precisa saber o que construir.",
         DISPLAY, 48, BLACK_INK, bold=True, spacing=-1.4, accents=[("o que construir.", GREEN_DEEP)])
sup = txt(s, MARGIN, 196, 540, 24, "Nossos clientes chegam com uma dor — não com uma especificação técnica.",
          SANS, 15, MUT_L)
steps = ["Dor", "Impacto", "Oportunidade", "Solução", "Tecnologia", "Resultado"]
railc_y = 330
xs = [75 + i * 162 for i in range(6)]
line(s, xs[0], railc_y, xs[-1], railc_y, BLACK_INK, 0.86, 1.5)
sgs = []
for i, (name, x) in enumerate(zip(steps, xs)):
    last = i == 5
    g = []
    g.append(oval(s, x, railc_y, 21, fill=GREEN if last else WHITE,
                  line_color=None if last else BLACK_INK, line_t=0.82, line_w=1.5))
    num = txt(s, x - 21, railc_y - 8, 42, 16, str(i + 1), DISPLAY, 13, BLACK_INK, bold=True, align="c")
    g.append(num)
    g.append(txt(s, x - 60, railc_y + 34, 120, 18, name, SANS, 13, BLACK_INK, align="c"))
    sgs.append(group(s, g))
progress(s, 4, dark=False)
fade(s, ey, 0.0)
fade(s, h1, 0.15, 0.55)
fade(s, sup, 0.4)
for i, sg in enumerate(sgs):
    fade(s, sg, 0.55 + i * 0.12, 0.35)
transition(s)
notes(s, 3)

# ============================================================ S5 · três soluções
s = slide_new()
ey = eyebrow(s, "Soluções")
h1 = txt(s, MARGIN, 78, 660, 110, "Três formas de transformar tecnologia em resultado.",
         DISPLAY, 40, WHITE, bold=True, spacing=-1.2, accents=[("resultado.", GREEN)])
cols = [
    ("01", "Nova Receita Digital", "Novos produtos digitais a partir dos ativos que a empresa já tem."),
    ("02", "Sistemas Sob Medida", "Sistemas específicos para eliminar gargalos e centralizar a operação."),
    ("03", "Agentes de IA", "IA conectada aos dados e sistemas da empresa, executando trabalho real."),
]
top = 235
colgs = []
for i, (num, name, one) in enumerate(cols):
    x = MARGIN + i * 284 + (30 if i > 0 else 0)
    g = []
    n = txt(s, x, top, 200, 80, num, DISPLAY, 78, GREEN, bold=True, spacing=-1.5)
    n.TextFrame2.TextRange.Font.Fill.Visible = False
    n.TextFrame2.TextRange.Font.Line.Visible = True
    n.TextFrame2.TextRange.Font.Line.ForeColor.RGB = GREEN
    n.TextFrame2.TextRange.Font.Line.Transparency = 0.35
    n.TextFrame2.TextRange.Font.Line.Weight = 1.1
    g.append(n)
    g.append(txt(s, x, top + 100, 230, 30, name, DISPLAY, 21, WHITE, bold=True, spacing=-0.4))
    g.append(txt(s, x, top + 134, 242, 60, one, SANS, 12.5, MUT_D, line=1.35))
    colgs.append(group(s, g))
for dx in (338, 622):
    line(s, dx, top, dx, top + 195, WHITE, 0.86, 1.0)
progress(s, 5)
fade(s, ey, 0.0)
fade(s, h1, 0.12, 0.5)
for i, cg in enumerate(colgs):
    fade(s, cg, 0.45 + i * 0.18, 0.45)
transition(s)
notes(s, 4)


def prod_head(s, num, eyebrow_text, h1_text, accents):
    n = txt(s, MARGIN, 48, 112, 70, num, DISPLAY, 68, GREEN, bold=True, spacing=-1.2)
    n.TextFrame2.TextRange.Font.Fill.Visible = False
    n.TextFrame2.TextRange.Font.Line.Visible = True
    n.TextFrame2.TextRange.Font.Line.ForeColor.RGB = GREEN
    n.TextFrame2.TextRange.Font.Line.Transparency = 0.35
    n.TextFrame2.TextRange.Font.Line.Weight = 1.1
    ey = eyebrow(s, eyebrow_text, y=52, x=192)
    h1 = txt(s, 192, 74, 660, 96, h1_text, DISPLAY, 38, WHITE, bold=True, spacing=-1.1, accents=accents)
    return group(s, [n, ey, h1])


# ============================================================ S6 · Nova Receita Digital
s = slide_new()
head = prod_head(s, "01", "Nova Receita Digital",
                 "Transforme sua base de clientes em uma nova fonte de receita.", [("nova fonte de receita.", GREEN)])
note_tag = txt(s, 756, 52, 150, 14, "ILUSTRATIVO", SANS, 8.5, MUT_D, spacing=1.4, align="r")
cy0, base_y = 190, 372
mx = [57, 317, 577, 837]
my = [350, 335, 272, 202]
ch = []
ch.append(line(s, mx[0], base_y, mx[3], base_y, WHITE, 0.86, 1.2))
ch.append(line(s, mx[0], 353, mx[3], 339, WHITE, 0.72, 1.4, dash=K.msoLineDash))
ch.append(txt(s, 690, 322, 147, 14, "receita atual", SANS, 9.5, MUT_D, align="r"))
area = bezier(s, [(mx[0], my[0]),
                  (155, 348, 230, 344, mx[1], my[1]),
                  (407, 325, 490, 302, mx[2], my[2]),
                  (667, 242, 757, 222, mx[3], my[3])],
              color=None, fill=GREEN, fill_t=0.9, close_to=[(mx[3], base_y), (mx[0], base_y)])
ch.append(area)
curve = bezier(s, [(mx[0], my[0]),
                   (155, 348, 230, 344, mx[1], my[1]),
                   (407, 325, 490, 302, mx[2], my[2]),
                   (667, 242, 757, 222, mx[3], my[3])], GREEN, 0.0, 2.4)
ch.append(curve)
ch.append(txt(s, 690, 178, 147, 14, "nova receita digital", SANS, 9.5, GREEN, align="r"))
labels = [("Base atual", "clientes, conhecimento, dados", "l"), ("Produto", "novo produto digital", "c"),
          ("Assinatura", "modelo de cobrança", "c"), ("Receita recorrente", "nova linha de receita", "r")]
for i, ((lab, det, al), x, y) in enumerate(zip(labels, mx, my)):
    last = i == 3
    ch.append(oval(s, x, y, 5.5, fill=GREEN if last else INK, line_color=None if last else WHITE,
                   line_t=0.5, line_w=1.5))
    bx = x if al == "l" else (x - 150 if al == "r" else x - 75)
    ch.append(txt(s, bx, base_y + 14, 150, 18, lab, SANS, 12, GREEN if last else LIGHT, align=al))
    ch.append(txt(s, bx, base_y + 32, 150, 14, det, SANS, 9.5, MUT_D, align=al))
chg = group(s, ch)
ask = txt(s, MARGIN, 458, 800, 24,
          "Se parte dos seus clientes pagasse por um novo produto digital, o que valeria a pena construir?",
          SANS, 14, MUT_D, accents=[("o que valeria a pena construir?", WHITE)])
progress(s, 6)
fade(s, head, 0.0, 0.5)
fade(s, note_tag, 0.2)
try:
    fade(s, chg, 0.4, 0.9, effect=K.msoAnimEffectWipe, direction=K.msoAnimDirectionLeft)
except Exception:
    fade(s, chg, 0.4, 0.7)
fade(s, ask, 1.1, 0.5)
transition(s)
notes(s, 5)

# ============================================================ S7 · Sistemas Sob Medida
s = slide_new()
head = prod_head(s, "02", "Sistemas Sob Medida",
                 "Sua operação é única. Seu sistema também pode ser.", [("Seu sistema também pode ser.", GREEN)])
y0 = 185
chips = [("Planilhas", 54, 22, 93), ("ERP", 139, 68, 72), ("E-mail", 69, 117, 83),
         ("Documentos", 154, 166, 105), ("Pessoas", 87, 216, 83)]
dg = []
box_x = 359
targets = [110, 114, 118, 123, 127]
for (name, cx_, cy_, w), ty in zip(chips, targets):
    x1, y1 = cx_ + w, y0 + cy_ + 15
    dg.append(bezier(s, [(x1, y1), ((x1 + box_x) / 2 + 30, y1, box_x - 40, y0 + ty, box_x, y0 + ty)],
                     WHITE, 0.76, 1.1))
for (name, cx_, cy_, w) in chips:
    dg.append(pill(s, cx_, y0 + cy_, w, 30, name, size=10.5))
dg.append(rect(s, box_x, y0 + 77, 218, 87, fill=GREEN, fill_t=0.94, line_color=GREEN, line_w=1.5, round_=0.22))
dg.append(txt(s, box_x, y0 + 103, 218, 24, "Sistema sob medida", DISPLAY, 16, WHITE, bold=True, align="c"))
dg.append(txt(s, box_x, y0 + 129, 218, 16, "construído em torno da operação", SANS, 9.5, MUT_D, align="c"))
dg.append(line(s, box_x + 218, y0 + 120, box_x + 274, y0 + 120, WHITE, 0.7, 1.2))
dg.append(oval(s, box_x + 246, y0 + 120, 3, fill=GREEN))
dg.append(pill(s, box_x + 276, y0 + 102, 210, 36, "Decisão com visibilidade",
               fill=GREEN, line_color=None, text_color=BLACK_INK, size=12.5))
dgg = group(s, dg)
ask = txt(s, MARGIN, 458, 700, 24, "Você conhece seu negócio; nós conhecemos tecnologia.",
          SANS, 14, MUT_D, accents=[("Você conhece seu negócio;", WHITE)])
progress(s, 7)
fade(s, head, 0.0, 0.5)
fade(s, dgg, 0.35, 0.7)
fade(s, ask, 0.9, 0.5)
transition(s)
notes(s, 6)

# ============================================================ S8 · Agentes de IA
s = slide_new()
head = prod_head(s, "03", "Agentes de IA",
                 "Coloque a IA para executar trabalho dentro da sua empresa.", [("executar trabalho", GREEN)])
y0 = 180
hcx, hcy = 274, y0 + 128
dg = [oval(s, hcx, hcy, 99, line_color=WHITE, line_t=0.86, line_w=1.2)]
sats = [("CRM", 344, 34, 78), ("ERP", 154, 24, 78), ("WhatsApp", 34, 107, 108),
        ("E-mail", 34, 197, 108), ("Documentos", 144, 276, 93), ("APIs", 344, 266, 78)]
for (name, sx, sy, w) in sats:
    scx = 54 + (sx - 36) * 0.75 + w / 2
    scy = y0 + sy * 0.75 + 13.5
    dg.append(line(s, hcx, hcy, scx, scy, WHITE, 0.78, 1.2))
dg.append(line(s, hcx + 40, hcy - 14, 483, y0 + 91, WHITE, 0.7, 1.2))
dg.append(line(s, hcx + 40, hcy + 14, 483, y0 + 163, WHITE, 0.7, 1.2))
dg.append(oval(s, 380, y0 + 106, 3, fill=GREEN))
for (name, sx, sy, w) in sats:
    dg.append(pill(s, 54 + (sx - 36) * 0.75, y0 + sy * 0.75, w, 27, name, size=10.5))
dg.append(oval(s, hcx, hcy, 43, fill=HUB, line_color=GREEN, line_w=1.5))
dg.append(txt(s, hcx - 40, hcy - 9, 80, 18, "Agente", DISPLAY, 14, WHITE, bold=True, align="c"))
dg.append(pill(s, 483, y0 + 73, 202, 36, "Trabalho executado", fill=GREEN, line_color=None,
               text_color=BLACK_INK, size=12.5))
dg.append(pill(s, 483, y0 + 145, 248, 36, "Humano quando necessário", fill=None,
               line_color=WHITE, line_t=0.62, text_color=LIGHT, size=12))
dgg = group(s, dg)
ask = txt(s, MARGIN, 458, 760, 24,
          "Não é um chatbot. É software que executa etapas de processos — com escopo, regras e permissões.",
          SANS, 14, MUT_D, accents=[("Não é um chatbot.", WHITE)])
progress(s, 8)
fade(s, head, 0.0, 0.5)
fade(s, dgg, 0.35, 0.7)
fade(s, ask, 0.9, 0.5)
transition(s)
notes(s, 7)

# ============================================================ S9 · onde os agentes atuam
s = slide_new()
ey = eyebrow(s, "Onde os agentes atuam")
h1 = txt(s, MARGIN, 76, 700, 60, "Atendimento, vendas e operação.",
         DISPLAY, 38, WHITE, bold=True, spacing=-1.1, accents=[("operação.", GREEN)])
data = [("Atendimento", ["Cliente", "Agente", "CRM atualizado", "Humano quando necessário"]),
        ("Vendas", ["Lead", "Qualificação", "Follow-up", "Vendedor preparado"]),
        ("Operação", ["Sistemas + dados", "Agente", "Análise", "Ação"])]
top = 195
colgs = []
for i, (cap, items) in enumerate(data):
    x = MARGIN + i * 284 + (30 if i > 0 else 0)
    g = [txt(s, x, top, 220, 26, cap, DISPLAY, 18, WHITE, bold=True, spacing=-0.3)]
    ry = top + 48
    g.append(line(s, x + 5, ry + 4, x + 5, ry + 3 * 33 + 6, WHITE, 0.86, 1.5))
    for j, item in enumerate(items):
        last = j == 3
        g.append(oval(s, x + 5, ry + j * 33 + 5, 5.5, fill=GREEN if last else INK,
                      line_color=None if last else MUT_D, line_w=1.5))
        g.append(txt(s, x + 20, ry + j * 33 - 2, 240, 18, item, SANS, 12.5,
                     GREEN if last else LIGHT))
    colgs.append(group(s, g))
for dx in (338, 622):
    line(s, dx, top, dx, top + 190, WHITE, 0.86, 1.0)
progress(s, 9)
fade(s, ey, 0.0)
fade(s, h1, 0.12, 0.5)
for i, cg in enumerate(colgs):
    fade(s, cg, 0.45 + i * 0.18, 0.45)
transition(s)
notes(s, 8)

# ============================================================ S10 · como trabalhamos (claro)
s = slide_new(dark=False)
ey = eyebrow(s, "Como trabalhamos", color=GREEN_DEEP, y=190)
h1 = txt(s, MARGIN, 215, 320, 160, "Da dor ao software.",
         DISPLAY, 54, BLACK_INK, bold=True, spacing=-1.6, accents=[("software.", GREEN_DEEP)])
steps10 = [("Entender", "Mapeamos problema, impacto e contexto."),
           ("Desenhar", "Solução, experiência, arquitetura e integrações."),
           ("Construir", "Ciclos curtos, validação contínua."),
           ("Implantar", "Na operação real."),
           ("Evoluir", "Uso, resultados e novas oportunidades.")]
vx, vy0, pitch = 470, 92, 76
line(s, vx + 21, vy0 + 21, vx + 21, vy0 + 4 * pitch + 21, BLACK_INK, 0.86, 1.5)
igs = []
for i, (tit, desc) in enumerate(steps10):
    y = vy0 + i * pitch
    last = i == 4
    g = [oval(s, vx + 21, y + 21, 21, fill=GREEN if last else WHITE,
              line_color=None if last else BLACK_INK, line_t=0.82, line_w=1.5)]
    g.append(txt(s, vx, y + 13, 42, 16, str(i + 1), DISPLAY, 13, BLACK_INK, bold=True, align="c"))
    g.append(txt(s, vx + 60, y + 4, 360, 22, tit, DISPLAY, 16.5, BLACK_INK, bold=True, spacing=-0.2))
    g.append(txt(s, vx + 60, y + 27, 360, 16, desc, SANS, 10.5, MUT_L))
    igs.append(group(s, g))
progress(s, 10, dark=False)
fade(s, ey, 0.0)
fade(s, h1, 0.12, 0.5)
for i, ig in enumerate(igs):
    fade(s, ig, 0.4 + i * 0.12, 0.35)
transition(s)
notes(s, 9)

# ============================================================ S11 · para quem
s = slide_new()
ey = eyebrow(s, "Para quem")
h1 = txt(s, MARGIN, 76, 852, 110, "Para empresas que já têm operação —\ne querem chegar ao próximo nível.",
         DISPLAY, 43, WHITE, bold=True, spacing=-1.2, accents=[("próximo nível.", GREEN)])
pdata = [("Processos que não escalam", 190), ("Sistemas desconectados", 172),
         ("Dados espalhados", 135), ("Oportunidades digitais não exploradas", 262)]
px = MARGIN
pgs = []
for name, w in pdata:
    pgs.append(pill(s, px, 232, w, 33, name, size=12.5))
    px += w + 11
clo = txt(s, MARGIN, 430, 640, 48,
          "Se a empresa já funciona, mas a tecnologia começou a limitar o crescimento, provavelmente existe algo que podemos construir.",
          SANS, 15, MUT_D, line=1.3, accents=[("provavelmente existe algo que podemos construir.", GREEN)])
progress(s, 11)
fade(s, ey, 0.0)
fade(s, h1, 0.12, 0.55)
for i, pg in enumerate(pgs):
    fade(s, pg, 0.5 + i * 0.1, 0.35)
fade(s, clo, 0.95, 0.5)
transition(s)
notes(s, 10)

# ============================================================ S12 · fechamento
s = slide_new()
discs(s, 862, 462, [247, 169, 97], [0.06, 0.07, 0.08])
logo = s.Shapes.AddPicture(LOGO, False, True, MARGIN, 42, -1, -1)
logo.Height = 24
h1 = txt(s, MARGIN, 165, 780, 180, "Qual problema da sua empresa valeria a pena resolver agora?",
         DISPLAY, 55, WHITE, bold=True, spacing=-1.6, accents=[("resolver agora?", GREEN)])
p1 = pill(s, MARGIN, 360, 232, 38, "WhatsApp +55 11 94879-3233", fill=GREEN, line_color=None,
          text_color=BLACK_INK, size=13, bold=False)
p2 = pill(s, MARGIN + 244, 360, 172, 38, "www.dreamy.app.br", size=13)
mic = txt(s, MARGIN, 414, 400, 20, "Vamos falar sobre o seu negócio.", SANS, 12, MUT_D)
progress(s, 12)
fade(s, h1, 0.15, 0.7)
fade(s, p1, 0.6, 0.45)
fade(s, p2, 0.72, 0.45)
fade(s, mic, 0.9)
transition(s)
notes(s, 11)

# ============================================================ salvar
pres.Slides(1).SlideShowTransition.EntryEffect = 0  # capa entra sem transição
prop = pres.BuiltInDocumentProperties
prop("Title").Value = "Dreamy — Apresentação Institucional"
prop("Author").Value = "Dreamy"
pres.EmbedTrueTypeFonts = True
if os.path.exists(OUT):
    os.remove(OUT)
pres.SaveAs(OUT, 24, -1)  # ppSaveAsOpenXMLPresentation + EmbedTrueTypeFonts=msoTrue
print("PPTX nativo salvo:", OUT, os.path.getsize(OUT), "bytes")

if SHOTS:
    os.makedirs(SHOTS, exist_ok=True)
    for i in range(1, pres.Slides.Count + 1):
        pres.Slides(i).Export(os.path.normpath(os.path.abspath(os.path.join(SHOTS, f"slide-{i:02d}.png"))), "PNG", 1920, 1080)
    print("shots exportados em", SHOTS)

pres.Close()
app.Quit()
