<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="DualView Logo">
</p>

<h1 align="center">DualView</h1>

<p align="center">
  <a href="https://dualview.hanayuki.xyz">
    <img src="https://img.shields.io/badge/App-dualview.hanayuki.xyz-ff5722?style=for-the-badge" alt="Open DualView">
  </a>
  <a href="https://github.com/YukiWorks432/dualview">
    <img src="https://img.shields.io/badge/GitHub-YukiWorks432-181717?style=for-the-badge&logo=github" alt="YukiWorks432 on GitHub">
  </a>
  <a href="https://hanayuki.xyz">
    <img src="https://img.shields.io/badge/Website-hanayuki.xyz-ff5722?style=for-the-badge" alt="hanayuki.xyz">
  </a>
  <a href="https://x.com/YuK1_Works">
    <img src="https://img.shields.io/badge/X-@YuK1__Works-000000?style=for-the-badge&logo=x" alt="@YuK1_Works on X">
  </a>
</p>

<p align="center">
  <sub>
    Originally created by <a href="https://github.com/gokayfem"><strong>Gökay Aydoğan</strong></a>
    · <a href="https://github.com/gokayfem/dualview">Upstream repository</a>
    · <a href="https://dualview.ai">Original website</a>
    · <a href="https://x.com/gokayfem">@gokayfem</a>
    · <a href="https://huggingface.co/gokaygokay">Hugging Face</a>
  </sub>
</p>

<p align="center">
  <strong>The Ultimate Comparison Tool for Creative Professionals</strong>
</p>

<p align="center">
  Compare delivery-ready videos and images with synchronized playback, visual analysis, and embedded-audio QA.<br>
  GPU-accelerated analysis • ProRes playback • Frame-accurate review • Exportable evidence
</p>

<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/24a2b466-a9d9-4b0a-990a-66b47b308357" alt="DualView Demo" width="100%">
</p>

<br>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#comparison-modes">Modes</a> •
  <a href="#webgl-analysis">Analysis</a> •
  <a href="#export">Export</a> •
  <a href="#shortcuts">Shortcuts</a> •
  <a href="#getting-started">Get Started</a> •
  <a href="#project-lineage">Lineage</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.3.0-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-7.0.2-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-8.3.0-646CFF?style=flat-square&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/WebGL-GPU_Accelerated-990000?style=flat-square&logo=webgl" alt="WebGL">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

<h2 id="project-lineage">Project Lineage</h2>

> [!NOTE]
> **DualView was originally created by [Gökay Aydoğan](https://github.com/gokayfem) in
> [gokayfem/dualview](https://github.com/gokayfem/dualview).**
> This repository is a maintained fork by [YukiWorks432](https://github.com/YukiWorks432),
> continuing that work with modernization, maintenance, and ongoing development while preserving
> attribution to the original project.

| Role                 | Links                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Original project** | [gokayfem/dualview](https://github.com/gokayfem/dualview) · [dualview.ai](https://dualview.ai)                                   |
| **Original creator** | [Gökay Aydoğan](https://github.com/gokayfem) · [@gokayfem](https://x.com/gokayfem)                                               |
| **Maintained fork**  | [dualview.hanayuki.xyz](https://dualview.hanayuki.xyz) · [YukiWorks432/dualview](https://github.com/YukiWorks432/dualview)       |
| **Fork maintainer**  | [YukiWorks432](https://github.com/YukiWorks432) · [@YuK1_Works](https://x.com/YuK1_Works) · [hanayuki.xyz](https://hanayuki.xyz) |

---

## Why DualView?

This maintained fork focuses on **pre-delivery image and video review**: checking client revisions, render changes, compression artifacts, and accidental differences before delivery.

> **Drop A/B media** → **Choose a comparison mode** → **Inspect differences** → **Save evidence**

| Input | Review |
| :---- | :----- |
| 🎬 **Video** | Synchronized playback, ProRes playback, scopes, SSIM/PSNR, heatmaps, WebGL analysis |
| 🖼️ **Image** | Slider, side-by-side, pixel/color difference, loupe, histogram, WebGL analysis |
| 🎵 **Embedded video audio** | Waveform, integrated loudness reference, sample peak, phase correlation, stereo width |

Standalone audio files, text/JSON, 3D models, and document comparison are not part of this maintained fork's current scope.

---

<h2 id="features">✨ Features at a Glance</h2>

<table>
<tr>
<td width="50%">

### 🎬 Video & Image

- Frame-by-frame navigation
- Synchronized playback
- Apple ProRes playback in-browser
- Loop regions with I/O points
- Multi-clip timeline editing
- Clip trimming & positioning

</td>
<td width="50%">

### 🔬 Analysis Tools

- SSIM & PSNR metrics
- Delta E perceptual difference
- Difference heatmaps including alpha
- Pixel inspector
- Magnifier loupe
- Video scopes

</td>
</tr>
<tr>
<td width="50%">

### 🎨 Comparison Modes

- 12 image/video review modes
- 50+ WebGL analysis shaders
- Slider and side-by-side review
- Blend, flicker, heatmap, and grid views
- Focus peaking and zebra analysis
- Synchronized pan/zoom

</td>
<td width="50%">

### 📤 Export Options

- Current comparison screenshots (PNG/JPEG)
- PDF comparison reports
- MP4, WebM, and GIF export for browser-native video
- WebGL transition and stitch exports
- Up to 4K screenshot resolution
- ProRes current-frame evidence via Image/PDF export

</td>
</tr>
<tr>
<td width="50%">

### 🎵 Embedded Audio QA

- Timeline-aware playback for trimmed/positioned clips
- Waveform visualization with playhead
- Integrated loudness reference comparison
- Sample Peak & RMS measurement
- Phase correlation & stereo width
- EBU R128 and ATSC A/85 reference targets

</td>
<td width="50%">

### 💾 Project Management

- Auto-save to IndexedDB
- Multiple projects support
- Import/Export `.dualview` files
- Built-in & custom templates
- Undo/Redo history

</td>
</tr>
</table>

---

<h2 id="comparison-modes">🎯 Comparison Modes</h2>

DualView currently exposes **12 comparison modes**:

### Primary Modes

| Mode | Key | Description |
| ---- | --- | ----------- |
| **Slider** | `1` | Draggable A/B reveal |
| **Side by Side** | `2` | View synchronized A/B media together |
| **Difference** | `3` | GPU-accelerated visual difference analysis |
| **Audio QA** | `4` | Analyze audio embedded in the current A/B videos |

### Additional Modes

| Mode | Description |
| ---- | ----------- |
| **Split Screen** | Multi-panel image/video layout |
| **Quad View** | Four-panel comparison |
| **Blend Modes** | Difference, overlay, multiply, and screen compositing |
| **Flicker** | Rapid A/B switching |
| **Heatmap** | Pixel and alpha difference visualization |
| **Radial Loupe** | Magnified circular comparison |
| **Grid Tile** | Checkerboard A/B comparison |
| **Morphological** | Morphological difference operations |

---

<h2 id="webgl-analysis">🔥 WebGL Analysis Engine</h2>

The heart of DualView is its **GPU-accelerated analysis engine** with **50+ GLSL shaders** organized into 8 categories:

<details>
<summary><strong>📊 Difference Analysis</strong> (10 modes)</summary>

| Mode       | What it does                                           |
| ---------- | ------------------------------------------------------ |
| Absolute   | RGB channel difference with amplification              |
| Perceptual | Delta E in LAB color space — how humans see difference |
| Luminance  | Brightness-only comparison                             |
| Chroma     | Color-only comparison (ignores brightness)             |
| Threshold  | Binary mask at configurable threshold                  |
| Amplified  | Magnify tiny differences 10x-100x                      |
| Wipe       | Vertical/horizontal A↔B comparison                     |
| Split      | Side-by-side 50/50                                     |
| Debug      | Raw texture output for troubleshooting                 |

</details>

<details>
<summary><strong>🏗️ Structural Analysis</strong> (5 modes)</summary>

| Mode             | What it does                                   |
| ---------------- | ---------------------------------------------- |
| SSIM Map         | Local structural similarity visualization      |
| Edge Comparison  | Sobel edge detection difference                |
| Gradient         | Gradient magnitude comparison                  |
| Local Contrast   | Contrast difference per region                 |
| Block Difference | Block-based comparison (compression artifacts) |

</details>

<details>
<summary><strong>🎨 Color Analysis</strong> (5 modes)</summary>

| Mode              | What it does                    |
| ----------------- | ------------------------------- |
| Hue Difference    | Color wheel position comparison |
| Saturation Map    | Vibrance difference             |
| False Color       | Rainbow gradient for amplitude  |
| Channel Split     | R/G/B separated                 |
| Histogram Overlay | Distribution comparison         |

</details>

<details>
<summary><strong>🎬 Professional Tools</strong> (6 modes)</summary>

| Mode            | What it does                  |
| --------------- | ----------------------------- |
| Anaglyph 3D     | Red/cyan stereoscopic view    |
| Checkerboard    | Alternating pixel tiles       |
| Onion Skin      | Semi-transparent overlay      |
| Loupe Wipe      | Magnified wipe comparison     |
| Frequency Split | Low/high frequency separation |
| Difference Mask | Use diff as alpha mask        |

</details>

<details>
<summary><strong>🎥 Video-Specific</strong> (4 modes)</summary>

| Mode              | What it does               |
| ----------------- | -------------------------- |
| Temporal Diff     | Frame-to-frame changes     |
| Motion Vectors    | Optical flow approximation |
| Flicker Detection | Unstable pixel detection   |
| Frame Blend       | Temporal averaging         |

</details>

<details>
<summary><strong>📐 Advanced Analysis</strong> (10+ modes)</summary>

| Mode               | What it does                              |
| ------------------ | ----------------------------------------- |
| Multi-scale Edge   | Laplacian pyramid edge comparison         |
| Local Contrast     | Standard deviation maps                   |
| Gradient Direction | Direction as hue visualization            |
| Optical Flow       | Motion vectors (8×8, 16×16, 32×32 blocks) |
| FFT Magnitude      | Frequency spectrum analysis               |
| Band-pass Filter   | Low/high/band frequency isolation         |
| Temporal Noise     | Frame-to-frame noise analysis             |
| Diff Accumulator   | Motion history over time                  |

</details>

<details>
<summary><strong>📷 Exposure Tools</strong> (8 modes)</summary>

| Mode                                        | Shortcut | What it does                                |
| ------------------------------------------- | -------- | ------------------------------------------- |
| False Color                                 | —        | Exposure level visualization (cinema style) |
| Focus Peaking                               | `P`      | Sharp edge highlighting                     |
| Zebra Stripes                               | `Z`      | Overexposure warning (100 IRE)              |
| Zone System                                 | —        | Ansel Adams exposure zones (0-X)            |
| _All above with A vs B comparison variants_ |

</details>

<details>
<summary><strong>⚖️ Perceptual Weighting</strong> (3 modes)</summary>

| Mode          | What it does                                |
| ------------- | ------------------------------------------- |
| Saliency      | Visual attention importance                 |
| Edge Weighted | Edge-aware comparison                       |
| Weighted SSIM | Perceptually-weighted structural similarity |

</details>

---

## 🎵 Embedded Video Audio QA

Audio QA analyzes the primary audio track embedded in the videos on Track A and Track B. Standalone audio-file import is intentionally outside the maintained fork's current scope.

The audio player follows timeline clip placement, trim in-points, and playback speed. Reverse-audio playback is currently not synthesized.

### Measurements

| Measurement | Current behavior |
| ----------- | ---------------- |
| **Integrated loudness** | Full decoded source-file estimate used against selectable reference targets |
| **Tail 400 ms / Tail 3 s** | Final 400 ms / 3 s of the decoded source, not live playhead meters |
| **Sample Peak** | Maximum decoded sample level; not presented as standards-compliant dBTP |
| **RMS** | Root mean square level |
| **Phase correlation** | Stereo phase relationship |
| **Stereo width** | Mid/side-derived width indicator |

Reference targets include Spotify, YouTube, Apple Music, EBU R128 (-23 LUFS), and ATSC A/85 (-24 LUFS). The ±1 LU indicator is a convenience comparison, not a certification of platform or broadcast compliance.

### Audio Shortcuts

| Key | Action |
| --- | ------ |
| `A` | Solo Track A |
| `B` | Solo Track B |
| `S` | Play both A+B |
| `Space` | Play/Pause |

---

<h2 id="export">📤 Export System</h2>

### Video Export

Export your comparisons as polished videos with professional transitions:

| Setting        | Options                      |
| -------------- | ---------------------------- |
| **Format**     | MP4 • WebM • GIF             |
| **Resolution** | 720p • 1080p • 4K            |
| **Frame Rate** | 24 • 30 • 60 fps             |
| **Quality**    | Low • Medium • High          |
| **Source**     | Comparison • A Only • B Only |

### 🌀 100+ GPU Transitions

Export with stunning WebGL shader transitions:

| Category       | Variants | Examples                                          |
| -------------- | -------- | ------------------------------------------------- |
| **Dissolve**   | 8        | Powder, Ink, Cellular, Bokeh, Fractal, Sparkle    |
| **Wipe**       | 12       | Radial, Spiral, Clock, Iris, Diamond, Heart, Star |
| **Zoom**       | 8        | Push, Pull, Dolly, Punch, Bounce, Elastic         |
| **Blur**       | 8        | Gaussian, Motion, Radial, Directional, Spin       |
| **Rotate**     | 8        | Flip, Spin, Cube, Fold, Swing                     |
| **Light**      | 8        | Leak, Glow, Flare, Flash, Strobe                  |
| **Prism**      | 8        | RGB Split, Spectral, Chromatic Aberration         |
| **Glitch**     | 8        | Scan, Tear, Block, Digital, VHS, Static           |
| **Morph**      | 8        | Warp, Liquify, Twist, Bulge, Wave, Ripple         |
| **Pixelate**   | 8        | Mosaic, Dither, Retro, 8-bit, Halftone            |
| **Refraction** | 8        | Glass, Water, Crystal, Heat Haze                  |
| **Shutter**    | 8        | Motion Lines, Echo, Trail, Persistence            |
| **Other**      | 12       | Kaleidoscope, Matrix, Film Burn, Comic            |

### 🎬 Sweep Animations

| Style            | Description                          |
| ---------------- | ------------------------------------ |
| Horizontal       | Left-to-right wipe reveal            |
| Vertical         | Top-to-bottom wipe reveal            |
| Diagonal         | Corner-to-corner reveal              |
| Circle           | Expanding circular reveal            |
| Rectangle        | Expanding rectangular reveal         |
| Spotlight        | Bouncing rectangle (DVD screensaver) |
| Spotlight Circle | Bouncing circle                      |

### 📸 Screenshot Export

- **Formats:** PNG, JPEG (with quality control)
- **Resolutions:** 720p, 1080p, 4K
- **Sources:** Current comparison view, A only, B only
- **Clipboard:** One-click copy
- **ProRes:** Current decoded frame is supported in screenshots and PDF reports

> [!NOTE]
> Animated Video/GIF, transition, and stitch export currently require browser-native video decoding.
> ProRes sources are rejected for those export paths instead of producing stale or incorrect frames.

---

<h2 id="shortcuts">⌨️ Keyboard Shortcuts</h2>

DualView is built for speed. Master these shortcuts:

### Playback

| Key               | Action                            |
| ----------------- | --------------------------------- |
| `Space`           | Play / Pause                      |
| `←` `→`           | Frame step (paused) or 1s seek    |
| `Shift` + `←` `→` | 5s seek                           |
| `J` `K` `L`       | Shuttle backward / stop / forward |
| `Home`            | Jump to start                     |
| `End`             | Jump to end                       |

### Loop & Markers

| Key      | Action                 |
| -------- | ---------------------- |
| `I`      | Set loop in-point      |
| `O`      | Set loop out-point     |
| `Escape` | Clear loop region      |
| `M`      | Add marker at playhead |

### Modes & Views

| Key       | Action                        |
| --------- | ----------------------------- |
| `1` - `4` | Switch primary comparison modes |
| `F`       | Flip A/B (in Difference mode) |
| `P`       | Toggle focus peaking          |
| `Z`       | Toggle zebra stripes          |
| `G`       | Toggle video scopes           |

### Timeline Editing

| Key      | Action                             |
| -------- | ---------------------------------- |
| `S`      | Split selected clip at playhead    |
| `Q`      | Keep left of playhead (trim right) |
| `W`      | Keep right of playhead (trim left) |
| `R`      | Toggle ripple edit mode            |
| `N`      | Toggle snapping                    |
| `Delete` | Delete selected clips              |

### Interface

| Key                      | Action                 |
| ------------------------ | ---------------------- |
| `T`                      | Toggle timeline        |
| `B`                      | Toggle sidebar         |
| `E`                      | Open export dialog     |
| `Shift` + `S`            | Quick screenshot       |
| `Shift` + `M`            | Toggle quality metrics |
| `Ctrl/⌘` + `Z`           | Undo                   |
| `Ctrl/⌘` + `Shift` + `Z` | Redo                   |
| `Ctrl/⌘` + `S`           | Save project           |
| `?`                      | Show all shortcuts     |

---

## 🎨 Video Scopes

Professional broadcast-style monitoring tools:

| Scope             | Purpose                         |
| ----------------- | ------------------------------- |
| **Histogram**     | RGB/Luma distribution           |
| **Color Wheel**   | Vectorscope-style chrominance   |
| **Gamut Warning** | Out-of-gamut pixel highlighting |

Toggle with `G` key.

---

## 💾 Project Management

- **Auto-save:** 500ms debounced saves to IndexedDB
- **Multiple projects:** Create, duplicate, delete
- **Import/Export:** `.dualview` JSON files with embedded media
- **Templates:** Built-in presets + custom templates
- **Metadata:** Title, description, tags

---

## 🛠️ Tech Stack

<table>
<tr>
<td>

| Core | Version |
| ---- | ------- |
| React | 19.3.0 |
| TypeScript | 7.0.2 |
| Vite | 8.3.0 |
| Zustand | 5.0.15 |
| Tailwind CSS | 4.3.3 |

</td>
<td>

| Media | Technology |
| ----- | ---------- |
| Native video decode | Browser media pipeline |
| ProRes decode | Mediabunny + TurboRes |
| Video encoding | WebCodecs / MediaRecorder |
| MP4 muxing | Mediabunny |
| GIF encoding | gif.js |
| PDF export | jsPDF |

</td>
</tr>
</table>

### Development Tooling

| Tool      | Purpose                              |
| --------- | ------------------------------------ |
| pnpm 12   | Package management and lockfile      |
| Oxfmt     | Formatting and import sorting        |
| Oxlint    | Type-aware linting                   |
| Vitest 5  | Unit tests                           |
| GitHub CI | Frozen install + full quality checks |

Heavy comparison modes and export tooling are split so they are loaded only when needed.

---

<h2 id="getting-started">🚀 Getting Started</h2>

```bash
# Clone this fork
git clone https://github.com/YukiWorks432/dualview.git
cd dualview

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run formatting, linting, type checks, tests, and production build
pnpm check

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Requirements

- Node.js 22.12+
- pnpm 12+
- Modern browser with WebGL 2.0 support
- WebCodecs `VideoEncoder` support for MP4 export

### Deployment

The maintained web app is deployed as Cloudflare Workers Static Assets at
[dualview.hanayuki.xyz](https://dualview.hanayuki.xyz). There is no application Worker or backend
API in the deployment path; Wrangler uploads the Vite `dist/` output directly.

The production bundle does not include `ffmpeg.wasm`. Video export uses browser-native WebCodecs
and MediaRecorder paths plus gif.js, so the former `ffmpeg-core.wasm` asset-size constraint does
not apply to the deployed `dist/`.

```bash
pnpm build
pnpm dlx wrangler@4 deploy
```

`wrangler.jsonc` owns the production Custom Domain and disables the `workers.dev` route. Missing
paths use the static `404.html` page instead of falling back to the application shell.

---

## 📁 Project Structure

```
src/
├── components/
│   ├── comparison/        # Image/video comparison and analysis modes
│   │   ├── SliderComparison.tsx
│   │   ├── SideBySide.tsx
│   │   ├── WebGLComparison.tsx
│   │   ├── AudioComparison.tsx
│   │   ├── BlendModes.tsx
│   │   └── DifferenceHeatmap.tsx
│   ├── export/            # Export configuration panels
│   ├── layout/            # Header, Sidebar, ExportDialog
│   ├── media/             # Native/ProRes visual surfaces and import UI
│   ├── preview/           # Main comparison capture surface
│   ├── timeline/          # Timeline editor + clips
│   ├── scopes/            # Video scopes
│   └── ui/                # Reusable components
├── stores/                # Zustand state management
├── hooks/                 # Playback, ProRes and UI hooks
├── lib/
│   ├── audio/             # Loudness, waveform and stereo analysis
│   ├── media/             # File probing, ProRes/audio decode, timeline mapping
│   ├── webgl/             # Comparison and transition shaders
│   ├── mp4Encoder.ts
│   ├── gifEncoder.ts
│   └── metrics.ts         # SSIM/PSNR calculation
└── types/
```

---

## 🎯 Use Cases

<table>
<tr>
<td width="50%">

### 🎨 Creative Delivery

- Client revision verification
- Before/after retouching checks
- Color grading comparison
- VFX render and animation QA

</td>
<td width="50%">

### 🔍 Quality Assurance

- Accidental-change detection
- Compression artifact inspection
- Frame-by-frame verification
- Screenshot/PDF evidence for review

</td>
</tr>
<tr>
<td width="50%">

### 🎬 Video Finishing

- ProRes source playback
- Embedded audio loudness reference checks
- Video scopes
- A/B synchronization

</td>
<td width="50%">

### 🤖 Generated Media Review

- Image generation A/B comparison
- Upscaling quality analysis
- Video output comparison
- Visual regression inspection

</td>
</tr>
</table>

---

## 🌐 Browser Support

| Browser      | Baseline target |
| ------------ | --------------- |
| Chrome 111+  | Supported       |
| Edge 111+    | Supported       |
| Firefox 114+ | Supported       |
| Safari 16.4+ | Supported       |

MP4 export additionally depends on the browser exposing the WebCodecs `VideoEncoder` API.
ProRes playback is decoded locally with Mediabunny/TurboRes; animated exports for ProRes are currently
disabled, while current-frame Image and PDF export remain available.

---

<details>
<summary><strong>Cite this project</strong></summary>

This repository is a maintained fork of the original
[gokayfem/dualview](https://github.com/gokayfem/dualview) project. The citation metadata keeps
credit to original creator Gökay Aydoğan while identifying YukiWorks432 as the maintainer of this
fork.

If your work depends on this maintained fork, GitHub's **Cite this repository** action uses
[CITATION.cff](CITATION.cff). A matching BibTeX entry is:

```bibtex
@software{Aydogan_YukiWorks432_DualView_2026,
  author  = {Aydoğan, Gökay and {YukiWorks432}},
  title   = {DualView},
  version = {1.0.0},
  year    = {2026},
  url     = {https://dualview.hanayuki.xyz},
  note    = {Maintained fork of https://github.com/gokayfem/dualview}
}
```

[Original project](https://github.com/gokayfem/dualview) ·
[Original author ORCID](https://orcid.org/0000-0002-2343-9433) ·
[Fork citation metadata](CITATION.cff)

</details>

## Credits

DualView's original work remains credited to **Gökay Aydoğan** and the
[gokayfem/dualview](https://github.com/gokayfem/dualview) project. This fork is maintained by
**YukiWorks432**.

|                      | GitHub                                          | X                                       | Website                              |
| -------------------- | ----------------------------------------------- | --------------------------------------- | ------------------------------------ |
| **Original creator** | [gokayfem](https://github.com/gokayfem)         | [@gokayfem](https://x.com/gokayfem)     | [dualview.ai](https://dualview.ai)   |
| **Fork maintainer**  | [YukiWorks432](https://github.com/YukiWorks432) | [@YuK1_Works](https://x.com/YuK1_Works) | [hanayuki.xyz](https://hanayuki.xyz) |

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

Contributions are welcome on this fork. Feel free to [open an issue](https://github.com/YukiWorks432/dualview/issues) or [submit a pull request](https://github.com/YukiWorks432/dualview/pulls).

---

<p align="center">
  <sub>Built with love for creators who care about every pixel</sub>
</p>
