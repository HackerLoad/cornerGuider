"""Erzeugt Splash-, Android-Vordergrund- und Monochrom-Icon aus assets/icon.png (deckendes Quadrat, 1024 px).

Aufruf: python3 scripts/make-app-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

A = os.path.join(os.path.dirname(__file__), '..', 'assets')
SIZE = 1024
art = Image.open(os.path.join(A, 'icon.png')).convert('RGBA')


def edge_color(img):
    """Mittlere Farbe des dunklen Himmels oben im Bild: Hintergrund der Adaptive-Icon-Ebene (keine Naht)."""
    px = img.convert('RGB').load()
    pts = [px[x, y] for y in range(10, 60, 5) for x in range(40, SIZE - 40, 20)]
    return tuple(sum(c[i] for c in pts) // len(pts) for i in range(3))


def rounded(img, radius_frac=0.225):
    mask = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=int(SIZE * radius_frac), fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def centered(img, scale):
    n = int(SIZE * scale)
    small = img.resize((n, n), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((SIZE - n) // 2, (SIZE - n) // 2))
    return canvas


# Splash: abgerundetes Logo (wie ein App-Icon) auf transparentem Grund
rounded(art).save(os.path.join(A, 'splash-icon.png'), optimize=True)

# Android-Vordergrund: Logo in der Sicherheitszone (ca. 72 %) auf transparentem Grund
bg = edge_color(art)
centered(art, 0.72).save(os.path.join(A, 'android-icon-foreground.png'), optimize=True)

# Monochrom (Android 13+, Themen-Icon): orange Linie, Punkt und weiße Fahrbahnmarkierungen als weiße Form
mono = Image.new('RGBA', art.size, (0, 0, 0, 0))
src = art.load()
dst = mono.load()
for y in range(SIZE):
    for x in range(SIZE):
        r, g, b, _ = src[x, y]
        orange = r > 190 and 90 < g < 190 and b < 100
        white = r > 215 and g > 215 and b > 215
        if orange or white:
            dst[x, y] = (255, 255, 255, 255)
# Öffnen (Erosion, dann Dilatation) entfernt feine Reflexe der Leitplanke, die Linien bleiben
alpha = mono.getchannel('A').filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
mono.putalpha(alpha)
centered(mono, 0.72).save(os.path.join(A, 'android-icon-monochrome.png'), optimize=True)

print('Hintergrundfarbe für app.config.ts:', '#%02x%02x%02x' % bg)
