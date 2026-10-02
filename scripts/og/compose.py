"""Compose the real UI capture in PDF, then rasterize with Poppler."""
from pathlib import Path
import subprocess
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tmp/pdfs/current-ui.png'
PDF = ROOT / 'tmp/pdfs/dualview-og.pdf'
PNG = ROOT / 'public/og-current-ui.png'
assert Image.open(SOURCE).size == (2880, 1640)
font_dir = Path(os.environ.get('OG_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
pdfmetrics.registerFont(TTFont('CardBold', str(font_dir / 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('CardRegular', str(font_dir / 'DejaVuSans.ttf')))
c = canvas.Canvas(str(PDF), pagesize=(1200, 630), invariant=1)
c.setTitle('DualView - Compare before you deliver')
c.setAuthor('DualView Contributors')
def color(value):
    c.setFillColor(HexColor(value))
def text(x, y, value, size, fill='#f5f5f5', font='CardBold'):
    color(fill)
    c.setFont(font, size)
    c.drawString(x, y, value)
color('#0c0c0f')
c.rect(0, 0, 1200, 630, fill=1, stroke=0)
# Violet accent follows the current application's primary controls.
color('#4931cd')
c.roundRect(48, 535, 6, 47, 3, fill=1, stroke=0)
text(70, 546, 'DualView', 34)
text(48, 415, 'Compare', 46)
text(48, 360, 'before you', 43)
text(48, 305, 'deliver.', 46)
text(48, 247, 'Image & video review', 22, '#c6c5d0')
text(48, 211, 'Side by side. In your browser.', 16, '#a6a5b3', 'CardRegular')
color('#a79af4')
c.roundRect(48, 161, 29, 3, 1.5, fill=1, stroke=0)
# Entire screenshot is preserved: no synthetic controls, crop, or retouching.
x, y, width = 390, 132, 762
height = width * 820 / 1440
color('#24232c')
c.roundRect(x - 2, y - 2, width + 4, height + 4, 6, fill=1, stroke=0)
c.drawImage(str(SOURCE), x, y, width=width, height=height)
text(390, 105, 'ACTUAL APP  /  LOCAL DEMO IMAGES', 10, '#8d8b9a')
color('#282730')
c.rect(48, 78, 1104, 1, fill=1, stroke=0)
text(48, 43, 'OPEN SOURCE', 12, '#aaa8b6')
text(830, 43, 'dualview.yukiworks432.workers.dev', 12, '#c6c5d0', 'CardRegular')
c.showPage()
c.save()
subprocess.run(['pdftoppm', '-singlefile', '-scale-to-x', '1200', '-scale-to-y', '630',
                '-png', str(PDF), str(PNG.with_suffix(''))], check=True)
with Image.open(PNG) as image:
    assert image.size == (1200, 630)
    image.convert('RGB').save(PNG, optimize=True)
    image.resize((600, 315), Image.Resampling.LANCZOS).save(ROOT / 'tmp/pdfs/social-preview.png')
print(PNG)
