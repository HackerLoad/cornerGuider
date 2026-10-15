"""Erzeugt die Bilder für die iOS-Live-Aktivität (assets/liveActivity/*.png, je < 4 KB).

Pfeil in der Farbe der Kurvenstufe, Stufenzahl in der Mitte. Aufruf: python3 scripts/make-live-activity-images.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'liveActivity')
GRADE = ['#ff5252', '#ff8a3d', '#ffb300', '#c6d93a', '#6fcf6f', '#4fc3f7']  # wie src/theme.ts
S = 4  # Überabtastung für glatte Kanten
W = 96


def font(size):
    for path, idx in [('/System/Library/Fonts/Helvetica.ttc', 1), ('/System/Library/Fonts/HelveticaNeue.ttc', 1)]:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=idx)
            except OSError:
                pass
    return ImageFont.load_default()


def arrow(direction, color, label):
    img = Image.new('RGBA', (W * S, W * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = S
    # Pfeil nach rechts; für links wird NUR die Form gespiegelt, die Zahl danach gezeichnet (sonst steht sie spiegelverkehrt)
    d.polygon([(6 * s, 28 * s), (54 * s, 28 * s), (54 * s, 10 * s), (92 * s, 48 * s), (54 * s, 86 * s), (54 * s, 68 * s), (6 * s, 68 * s)], fill=color)
    cx = 30 * s
    if direction == 'left':
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        cx = (W - 30) * s
        d = ImageDraw.Draw(img)
    f = font(46 * s)
    bbox = d.textbbox((0, 0), label, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], 48 * s - th / 2 - bbox[1]), label, font=f, fill='#000000')
    return img.resize((W, W), Image.LANCZOS)


def simple(color, kind):
    img = Image.new('RGBA', (W * S, W * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = S
    d.ellipse((6 * s, 6 * s, 90 * s, 90 * s), outline=color, width=8 * s)
    if kind == 'offroute':
        d.line((28 * s, 28 * s, 68 * s, 68 * s), fill=color, width=9 * s)
        d.line((68 * s, 28 * s, 28 * s, 68 * s), fill=color, width=9 * s)
    elif kind == 'gps':
        d.ellipse((38 * s, 38 * s, 58 * s, 58 * s), fill=color)
    elif kind == 'finish':
        d.line((26 * s, 50 * s, 42 * s, 66 * s), fill=color, width=9 * s)
        d.line((42 * s, 66 * s, 70 * s, 32 * s), fill=color, width=9 * s)
    return img.resize((W, W), Image.LANCZOS)


def small(img):
    """Palette mit wenigen Farben, damit die Datei unter der 4-KB-Grenze von ActivityKit bleibt."""
    return img.quantize(colors=16, method=Image.FASTOCTREE)


os.makedirs(OUT, exist_ok=True)
for direction in ('left', 'right'):
    for grade in range(1, 7):
        name = f'curve_{direction}_{grade}.png'
        arrow(direction, GRADE[grade - 1], str(grade)).save(os.path.join(OUT, name), optimize=True)
small(simple('#ff5252', 'offroute')).save(os.path.join(OUT, 'offroute.png'), optimize=True)
small(simple('#9aa4ad', 'gps')).save(os.path.join(OUT, 'gps.png'), optimize=True)
small(simple('#6fcf6f', 'finish')).save(os.path.join(OUT, 'finish.png'), optimize=True)
for f in sorted(os.listdir(OUT)):
    size = os.path.getsize(os.path.join(OUT, f))
    print(f, size, 'OK' if size < 4096 else 'ZU GROSS')
