# Social preview generation

The 1200×630 card uses an actual production UI screenshot, composed with editable
text in a PDF using ReportLab, then rasterized with Poppler. No UI is mocked or
retouched. The entire screenshot is scaled proportionally without cropping.

## Reproduce

Use the repository's Node/pnpm versions and installed dependencies, Python 3 with
`reportlab` and `Pillow`, Poppler (`pdftoppm`), and DejaVu Sans fonts. On Debian the
font files are in `/usr/share/fonts/truetype/dejavu`; set `OG_FONT_DIR` elsewhere.
The embedded fonts avoid PDF viewer substitution. The app uses its configured
system sans fallback; remote Adobe fonts are blocked for an offline capture.

```sh
pnpm build
pnpm preview --host 127.0.0.1 --port 4175
# In a second terminal:
pnpm exec playwright install chromium
node scripts/og/capture.mjs
python3 scripts/og/compose.py
```

Set `OG_CHROMIUM_PATH` to use an installed Chromium binary, and `OG_BASE_URL` to
change the local preview address (keep the hostname `127.0.0.1`). Run scripts from
the repository root. The capture uses a fresh browser context, a 1440×820 viewport
at 2× device scale, real file-chooser imports, closed menus, and the default slider
view. The two original, deterministic landscape PNGs represent different color
grades. They contain no third-party or private material. Only loopback network
requests are permitted. Images, raw 2880×1640 capture, PDF, and 600×315 inspection
preview are regenerated under ignored `tmp/pdfs/`.

The PDF keeps a 48 px safe margin, a large headline, and the current violet/dark
visual language. The final asset is `public/og-current-ui.png`; both image metadata
URLs in `index.html` use that new path to refresh old social caches. The legacy
`og-image.png` remains available for already-shared links. The screenshot shows
image comparison; the broader image/video wording describes supported product
capabilities, not a claim that the fixture is video.

Inspect both `public/og-current-ui.png` and `tmp/pdfs/social-preview.png` after
regeneration. Check text readability, no clipping/overlap, the actual current UI,
matching OG/Twitter URL and alt text, and the 1200×630 output. The tiny app controls
provide visual context; the headline carries the message at social-preview size.
Commit the scripts and final PNG, not transient captures, fixtures, or PDFs.
