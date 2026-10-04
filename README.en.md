<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="DualView Logo">
</p>

<h1 align="center">DualView</h1>

<p align="center">
  <a href="https://dualview.yukiworks432.workers.dev">
    <img src="https://img.shields.io/badge/App-dualview.yukiworks432.workers.dev-ff5722?style=for-the-badge" alt="Open DualView">
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
  <strong>Image and Video Comparison for Creative Review</strong>
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
  <a href="README.md">日本語</a> •
  <a href="#start-a-comparison">Start a comparison</a> •
  <a href="#features">Features</a> •
  <a href="#comparison-modes">Modes</a> •
  <a href="#webgl-analysis">Analysis</a> •
  <a href="#export">Export</a> •
  <a href="#shortcuts">Shortcuts</a> •
  <a href="#getting-started">Get Started</a> •
  <a href="#project-lineage">Lineage</a> •
  <a href="#guides">Guides</a>
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
> This repository is a maintained fork by [花雪 / HanaYuki](https://github.com/YukiWorks432),
> continuing that work with modernization, maintenance, and ongoing development while preserving
> attribution to the original project.

| Role                 | Links                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Original project** | [gokayfem/dualview](https://github.com/gokayfem/dualview) · [dualview.ai](https://dualview.ai)                                                     |
| **Original creator** | [Gökay Aydoğan](https://github.com/gokayfem) · [@gokayfem](https://x.com/gokayfem)                                                                 |
| **Maintained fork**  | [dualview.yukiworks432.workers.dev](https://dualview.yukiworks432.workers.dev) · [YukiWorks432/dualview](https://github.com/YukiWorks432/dualview) |
| **Fork maintainer**  | [花雪 / HanaYuki](https://github.com/YukiWorks432) · [@YuK1_Works](https://x.com/YuK1_Works) · [hanayuki.xyz](https://hanayuki.xyz)                |

---

## Start a comparison

1. [Open the app](https://dualview.yukiworks432.workers.dev) and import your images or videos.
2. Place the sources on Track A and Track B. Align clip positions and trim points as needed.
3. Choose `Slider` to move an A/B boundary or `Side by Side` to view both sources. Play videos
   together, then pause to inspect individual frames.
4. Open `Difference` for visual analysis or `Audio QA` for audio embedded in the videos.
5. Export an image or PDF for review. Save a `.dualview` project to keep the editable comparison
   and media together.

Local media is processed in your browser without being uploaded to the operator. URL import connects
directly to the source URL. Projects are automatically stored in this browser; export a separate backup
of important work. See [Privacy and data handling](https://dualview.yukiworks432.workers.dev/privacy/).

## Why DualView?

This maintained fork focuses on **pre-delivery image and video review**: checking client revisions, render changes, compression artifacts, and accidental differences before delivery.

> **Drop A/B media** → **Choose a comparison mode** → **Inspect differences** → **Save evidence**

| Input                       | Review                                                                                |
| :-------------------------- | :------------------------------------------------------------------------------------ |
| 🎬 **Video**                | Synchronized playback, ProRes playback, scopes, SSIM/PSNR, heatmaps, WebGL analysis   |
| 🖼️ **Image**                | Slider, side-by-side, pixel/color difference, loupe, histogram, WebGL analysis        |
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
- 58 WebGL analysis modes across 8 categories
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

### What clip edits preserve

Splitting, trimming, duplicating, and pasting clips preserve constant playback speed and reverse
settings. Ripple editing moves later clips on the same track to account for the change in duration.
Replacing media preserves the clip position and source trim in-point, then uses the replacement's
remaining duration. If the replacement ends before that in-point, DualView explains the problem and
retains the previous edit.

Saved projects can still load keyframes. Splitting, trimming the start, and keeping only the right
side are unavailable for keyframed clips until their time-remapping behavior is defined; these
operations explain the restriction and retain the data. Duplicate and paste preserve relative times
and interpolation. End trims and keep-left edits retain keyframes outside the remaining interval,
and Undo/Redo restores them with the clip.

---

<h2 id="comparison-modes">🎯 Comparison Modes</h2>

DualView currently exposes **12 comparison modes**:

### Primary Modes

| Mode             | Key | Description                                      |
| ---------------- | --- | ------------------------------------------------ |
| **Slider**       | `1` | Draggable A/B reveal                             |
| **Side by Side** | `2` | View synchronized A/B media together             |
| **Difference**   | `3` | GPU-accelerated visual difference analysis       |
| **Audio QA**     | `4` | Analyze audio embedded in the current A/B videos |

### Additional Modes

| Mode              | Description                                           |
| ----------------- | ----------------------------------------------------- |
| **Split Screen**  | Multi-panel image/video layout                        |
| **Quad View**     | Four-panel comparison                                 |
| **Blend Modes**   | Difference, overlay, multiply, and screen compositing |
| **Flicker**       | Rapid A/B switching                                   |
| **Heatmap**       | Pixel and alpha difference visualization              |
| **Radial Loupe**  | Magnified circular comparison                         |
| **Grid Tile**     | Checkerboard A/B comparison                           |
| **Morphological** | Morphological difference operations                   |

Heatmap separates single-frame drawing from the playback loop and reuses input canvases and output
pixel arrays. While paused, it updates only for frame, setting, or display-size changes. Leaving a
comparison view cancels pending drawing and releases scratch buffers.

WebGL Split View uses the same native video, ProRes, or image sources for its central analysis as for
its sides, following shared playback position, trims, speed, and reverse settings. Repeated seeks apply
the latest request after an active seek completes. Gaps and frames still pending after a paused seek
clear the old central analysis. Only flicker detection and the two zebra animations continuously redraw
while paused.

Comparison previews still update after loading and seeking when the frame-notification API is
unavailable. Current-frame difference regions require that API, run only while paused, are enabled by
default, and stay out of exports. The separate timeline analysis examines the full timeline without
controlling the preview. See [Find differences](docs/user-guide.en.md#find-differences).

---

<h2 id="webgl-analysis">🔥 WebGL Analysis Engine</h2>

The **GPU-accelerated analysis engine** exposes **58 WebGL analysis modes across 8 categories**.
The counts below include separate direction, size, and A/B comparison variants in the current
[type definitions](src/types/index.ts). The [comparison shader registry](src/lib/webgl/comparison-shaders)
is the implementation reference.

Choose a view by the kind of change you need to inspect, then adjust amplification and thresholds.
Check the original A/B images alongside metrics and false-color views. Analysis results are reference
information, not certification of quality or broadcast/platform compliance. See the
[analysis reference](docs/analysis-reference.md#english) for interpretation limits.

<details>
<summary><strong>📊 Difference Analysis</strong> (10 modes)</summary>

| Mode            | What it does                                           |
| --------------- | ------------------------------------------------------ |
| Absolute        | RGB channel difference with amplification              |
| Perceptual      | Delta E in LAB color space — how humans see difference |
| Luminance       | Brightness-only comparison                             |
| Chroma          | Color-only comparison (ignores brightness)             |
| Threshold       | Binary mask at configurable threshold                  |
| Amplified       | Magnify tiny differences 10x-100x                      |
| Vertical Wipe   | Vertical A/B boundary                                  |
| Horizontal Wipe | Horizontal A/B boundary                                |
| Split           | Side-by-side 50/50                                     |
| Debug           | Raw texture output for troubleshooting                 |

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
<summary><strong>📐 Advanced Analysis</strong> (17 modes)</summary>

| Mode                     | What it does                                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| Multi-scale Edge         | Laplacian pyramid edge comparison                                                |
| Local Contrast           | Local standard-deviation maps                                                    |
| Gradient Direction       | Gradient orientation mapped to hue                                               |
| Direction Histogram      | Distribution of gradient directions                                              |
| Optical Flow             | Block-based motion approximation, with configurable block size (including 16×16) |
| Optical Flow 8×8         | Fine-grained block-based motion approximation                                    |
| Optical Flow 32×32       | Coarse block-based motion approximation                                          |
| FFT Magnitude            | Laplacian-based approximation of frequency magnitude                             |
| FFT Phase                | Gradient-direction-based phase visualization                                     |
| Low-pass Filter          | Isolate lower-frequency structure                                                |
| High-pass Filter         | Isolate higher-frequency detail and noise                                        |
| Band-pass Filter         | Isolate a selected frequency band                                                |
| Temporal Noise           | Frame-to-frame noise and temporal changes                                        |
| Noise Variance           | Spatial noise variance                                                           |
| Diff Accumulator         | Maximum difference accumulated over supplied frames                              |
| Average Diff Accumulator | Average accumulated difference                                                   |
| Motion History           | Accumulated motion with decay                                                    |

FFT Magnitude and FFT Phase are approximations, not exact discrete Fourier-transform measurements.
Temporal displays depend on the frame history supplied to them.

</details>

<details>
<summary><strong>📷 Exposure Tools</strong> (8 modes)</summary>

| Mode          | Shortcut | What it does                                |
| ------------- | -------- | ------------------------------------------- |
| False Color   | —        | Exposure level visualization (cinema style) |
| Focus Peaking | `P`      | Sharp edge highlighting                     |
| Zebra Stripes | `Z`      | Overexposure warning (100 IRE)              |
| Zone System   | —        | Ansel Adams exposure zones (0-X)            |

Each of the four tools has a separate A/B comparison variant, for eight exposure modes in total.

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

| Measurement                | Current behavior                                                            |
| -------------------------- | --------------------------------------------------------------------------- |
| **Integrated loudness**    | Full decoded source-file estimate used against selectable reference targets |
| **Tail 400 ms / Tail 3 s** | Final 400 ms / 3 s of the decoded source, not live playhead meters          |
| **Sample Peak**            | Maximum decoded sample level; not presented as standards-compliant dBTP     |
| **RMS**                    | Root mean square level                                                      |
| **Phase correlation**      | Stereo phase relationship                                                   |
| **Stereo width**           | Mid/side-derived width indicator                                            |

Reference targets include Spotify, YouTube, Apple Music, EBU R128 (-23 LUFS), and ATSC A/85 (-24 LUFS). The ±1 LU indicator is a convenience comparison, not a certification of platform or broadcast compliance.

Embedded-audio analysis keeps the existing 512 MiB decoded-PCM limit per input, with at most 1 GiB retained for A/B playback. Decode and analysis jobs run one at a time. Before allocation, the application checks a 2 GiB estimate that includes the other side's retained PCM, the new output PCM, an additional output-sized decoder allowance, and the analysis workspace. This is a planning limit for PCM and analysis resources, not a guarantee about browser process memory: encoded input, video resources, native decoder overhead, and garbage-collection timing are outside that estimate.

Analysis keeps filter state and loudness-window results instead of full-length intermediate PCM arrays, and regularly yields to handle input and cancellation. Changing a source or leaving Audio QA cancels active and queued work, stops its playback sources, and releases the old PCM references. Inputs above the limits report the reason in the Audio QA view.

### Audio Shortcuts

| Key     | Action        |
| ------- | ------------- |
| `A`     | Solo Track A  |
| `B`     | Solo Track B  |
| `S`     | Play both A+B |
| `Space` | Play/Pause    |

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

Use WebGL transitions when exporting a comparison. The table preserves the family inventory and
shows current UI labels; the [transition registry](src/lib/webgl/shaders/index.ts) is the source for
exact variants. Crossfade is available as its own family and within Stylized.

| Category             | Variants | Examples                                                                                                                    |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Crossfade**        | 1        | Blend between sources                                                                                                       |
| **Dissolve**         | 8        | Powder, Ink, Cellular, Bokeh, Fractal, Smoke, Sand, Sparkle                                                                 |
| **Wipe**             | 12       | Left, Right, Up, Down, Radial, Radial CCW, Spiral, Clock, Clock CCW, Iris, Blinds H, Blinds V                               |
| **Zoom**             | 8        | Zoom In, Zoom Out, Zoom Push, Zoom Pull, Zoom Blur, Zoom Rotate, Zoom Bounce, Zoom Spiral                                   |
| **Blur**             | 8        | Gaussian, Motion, Radial, Dreamy, Bokeh, Directional, Spin, Focus                                                           |
| **Rotate**           | 8        | Clockwise, Counter-CW, Flip H, Flip V, Spin 3D, Swirl, Cube, Fold                                                           |
| **Light**            | 8        | Soft Leak, Hard Leak, Glow Veil, Lens Flare, Flash, Light Rays, Burn, Fade White                                            |
| **Prism**            | 8        | RGB Split, Spectral Smear, Chroma Pulse, Rainbow, Prism Wipe, Aberration, Color Shift, Dispersion                           |
| **Glitch**           | 8        | Scan Jitter, Line Tear, Block Drift, Digital, Corrupt, Static, VHS, Data Mosh                                               |
| **Morph**            | 8        | Smooth, Warp, Liquify, Twist, Bulge, Wave, Ripple, Melt                                                                     |
| **Pixelate**         | 8        | Block, Dither, Mosaic, Retro, 8-Bit, Halftone, Dots, Crosshatch                                                             |
| **Refraction**       | 8        | Micro Lens, Glass Ripple, Heat Haze, Water, Crystal, Diamond, Frosted, Bubble                                               |
| **Shutter**          | 8        | Dir. Smear, Frame Echo, Time Ghost, Trail, Streak, Motion Lines, Afterimage, Persistence                                    |
| **Stylized (Other)** | 12       | Kaleidoscope, Liquid Metal, Neon Dreams, Aurora, Matrix, Film Burn, TV Static, Comic, Sketch, Negative, Solarize, Crossfade |

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

### Stitch Export

Stitch export combines media into composed comparison sequences. It follows the same native-video
input restriction as animated video/GIF and transition exports.

### 📸 Screenshot Export

- **Formats:** PNG, JPEG (with quality control)
- **Resolutions:** 720p, 1080p, 4K
- **Sources:** Current comparison view, A only, B only
- **Clipboard:** One-click copy
- **ProRes:** Current decoded frame is supported in screenshots and PDF reports

> [!NOTE]
> Animated Video/GIF, transition, and stitch export currently require browser-native video decoding.
> ProRes sources are rejected for those export paths instead of producing stale or incorrect frames.

Animated exports can be cancelled with **Cancel**. After cancellation or a failed export,
resources are released before another export can start. MP4 requires WebCodecs `VideoEncoder`.
MP4 and GIF do not require WebM support;
GIF encoding uses the bundled local worker. Borrowed preview videos return to their paused position.

---

<h2 id="shortcuts">⌨️ Keyboard Shortcuts</h2>

Use these shortcuts for playback, comparison, and editing:

### Playback

| Key               | Action                            |
| ----------------- | --------------------------------- |
| `Space`           | Play / Pause                      |
| `←` `→`           | Frame step (paused) or 1s seek    |
| `Shift` + `←` `→` | 5s seek                           |
| `J` `K` `L`       | Shuttle backward / stop / forward |
| `Home`            | Jump to start                     |
| `End`             | Jump to end                       |

All transport controls share one playback clock. Repeated J or L presses shuttle at
1×, 2×, 4×, then 8× in the selected direction. Space pauses or resumes that direction;
K stops and resets the speed to 1× forward. Choosing a speed also selects forward
playback. End stops on the final timeline frame, and loops wrap in either direction.
Paused marker jumps and seeks refresh native and ProRes frames; reverse shuttle is
silent because reverse audio is not synthesized.

### Loop & Markers

| Key      | Action                 |
| -------- | ---------------------- |
| `I`      | Set loop in-point      |
| `O`      | Set loop out-point     |
| `Escape` | Clear loop region      |
| `M`      | Add marker at playhead |

### Modes & Views

| Key       | Action                          |
| --------- | ------------------------------- |
| `1` - `4` | Switch primary comparison modes |
| `F`       | Flip A/B (in Difference mode)   |
| `P`       | Toggle focus peaking            |
| `Z`       | Toggle zebra stripes            |
| `G`       | Toggle video scopes             |

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

Comparison-mode shortcuts take priority over timeline editing and global actions. In `Audio QA`,
`A`, `B`, and `S` select Track A, Track B, and both tracks. `B` does not toggle the sidebar and `S`
does not split clips in this mode. Ctrl/Command editing, saving and Undo/Redo, and Shift+S screenshots
keep their usual meanings. `G` toggles gamut warnings in Difference and video scopes in other modes.
Unmodified digits switch comparison modes; Shift+1–4 in Quad View select its panes, and Alt+1/2
filter videos/images only while the media library is visible.

Input, textarea, select and contenteditable controls, IME composition, and open dialogs protect
against global shortcuts. Escape in a dialog closes only that dialog, restores focus, and preserves
the loop. Escape cancels an active clip drag or closes its menu even if an input retains focus,
without changing the input value or loop; IME composition and dialogs still take priority.

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

Local files added to DualView are processed in the browser and are not uploaded to the operator.
Projects and media are saved in this browser so you can continue later.

Auto-save includes all stored comparison, scope, export and timeline settings, project metadata,
media replacements and keyframe edits. The indicator stays unsaved while newer edits are pending,
shows saving during the latest write, and reports write failures. Playback position is included in
the next save for restoration, but playback ticks, analysis progress, pointer information and
selection changes alone do not schedule writes. The existing project file format is unchanged.

Creating or opening a project first saves the outgoing edits. The current project stays available
until the destination has been fully read and decoded; a save or load failure keeps your current
edits and media, and the Projects dialog shows the error so you can retry. If several switches
overlap, only the latest request can become active. Undo/Redo, selections, clip/keyframe clipboards,
and playback are reset when a project is opened, created, or the active project is deleted.
Undo/Redo continues to work for edits made within the current project session.

File selection, drag and drop, image paste, and URL import follow the same rules for accepting results.
Removing a source, clearing the media list, or creating/loading a project invalidates affected imports
and retries. Their late results cannot add media or clips. Unused object URLs and decoding resources
are released. Closing the URL import dialog cancels its request. Local files are copied into an
independent browser-owned file before processing.

Filmstrip extraction continues through clip moves, trims, and view toggles. Matching media and settings
reuse extracted frames; failed extraction falls back to ordinary thumbnails. Removing or replacing
media discards pending extraction and cached results. The timeline samples at one-second intervals,
up to 60 thumbnails. Extraction uses native browser video decoding, so ProRes filmstrips depend on
native browser support independently of the ProRes decoder used for the comparison preview.

URL import connects directly to the URL you enter to fetch that media. Other local files already
loaded in DualView are not sent to that destination.

A downloaded `.dualview` project includes the media itself, so share it with the same care as the
source files. Clearing browser site data removes saved projects and media, so export important work
before doing so.

### A/B Frame Difference Lane

Use **Analyze** in the timeline to compare the displayed video frames on tracks A and B. The
analysis reads encoded frame timestamps, maps each frame interval through clip trims, playback speed,
and reverse playback, then decodes and compares frames in a dedicated worker. Mediabunny handles
video decoding, including ProRes through its ProRes decoder. The analysis does not seek or pause the
shared preview. Click the lane to seek, or use the previous/next controls to visit each highlighted
interval. Analysis requires browser Worker and OffscreenCanvas support.

The default comparison size is at most 640 pixels on the longest image edge. **Full** compares at
the source display dimensions and can use substantially more memory. Pixel threshold controls how
different an individual pixel must be; area threshold controls the share of changed pixels needed to
highlight an interval. The default values are 0.10 and 2%, respectively. Transparent pixels are
compared by their visible color and opacity, while hidden RGB values under two fully transparent
pixels do not create a difference.

The lane marks missing frames or A/B gaps, unsupported media, and decode errors separately from
frames with no detected difference, and distinguishes analyzed intervals from portions the analysis
has not reached yet. Image clips are unsupported by this video-frame analysis.
Analysis results are kept only in the current browser session and are discarded when the project,
timeline, source media, pixel threshold, or resolution changes. Changing the area threshold updates
highlights from the current frame scores without decoding again.

### Current-frame Difference Regions

Slider and Side by Side outline local differences on the current A/B frame by default; the setting
can be turned off. The frame-notification API is required. Region highlighting runs only while playback is paused; starting playback hides
the rectangles and stops this analysis path. Paused seeks and frame steps invalidate the previous
result and analyze the newly displayed frame once both sides are ready.

The region detector reuses the same pixel-difference semantics as the timeline analysis, then groups
connected changed pixels into rectangles. Sensitivity, small-region filtering, and automatic or full
common-resolution analysis can be adjusted independently for this view. The SVG overlays are for
interactive inspection and are not included in screenshot or video exports.

Published site information:
[Privacy](https://dualview.yukiworks432.workers.dev/privacy/) ·
[Terms](https://dualview.yukiworks432.workers.dev/terms/) ·
[About](https://dualview.yukiworks432.workers.dev/about/) ·
[Licenses](https://dualview.yukiworks432.workers.dev/licenses/)

---

## 🛠️ Tech Stack

These are the declared dependency baselines for this revision. [package.json](package.json) and
[pnpm-lock.yaml](pnpm-lock.yaml) are authoritative for dependency ranges and resolved versions; keep
them consistent when updating dependencies.

<table>
<tr>
<td>

| Core         | Version |
| ------------ | ------- |
| React        | 19.3.0  |
| TypeScript   | 7.0.2   |
| Vite         | 8.3.0   |
| Zustand      | 5.0.15  |
| Tailwind CSS | 4.3.3   |

</td>
<td>

| Media               | Technology                |
| ------------------- | ------------------------- |
| Native video decode | Browser media pipeline    |
| ProRes decode       | Mediabunny + TurboRes     |
| Video encoding      | WebCodecs / MediaRecorder |
| MP4 muxing          | Mediabunny                |
| GIF encoding        | gif.js                    |
| PDF export          | jsPDF                     |

</td>
</tr>
</table>

### Development Tooling

| Tool        | Purpose                                     |
| ----------- | ------------------------------------------- |
| pnpm 12.5.1 | Package management and lockfile             |
| Oxfmt       | Formatting and import sorting               |
| Oxlint      | Type-aware linting                          |
| Vitest 5    | Unit tests                                  |
| Playwright  | Chromium browser tests                      |
| GitHub CI   | Frozen install + quality and browser checks |

### Fluid Functionalism surfaces

The relative elevation system is sourced from Fluid Functionalism's `@fluid/elevated` registry
item. `components.json` registers `@fluid`; the upstream-owned implementation lives in
`src/lib/surface-context.ts`, `src/lib/surface-provider.tsx`, `src/lib/surface-classes.ts`, and
`src/lib/elevated.tsx`.
DualView-specific `asChild` compatibility and control-surface variables stay isolated in
`src/components/ui/surface.ts`.

Review upstream changes before syncing:

```bash
pnpm dlx shadcn@latest add @fluid/elevated --diff
pnpm dlx shadcn@latest add @fluid/elevated --dry-run
```

After applying an accepted registry update, keep project-specific behavior in the compatibility
adapter, retain third-party licenses and notices, and run `pnpm check`.

Heavy comparison modes and export tooling are split so they are loaded only when needed.

---

<h2 id="getting-started">🚀 Getting Started</h2>

Use Node.js 24.21.0 from [.node-version](.node-version) and pnpm 12.5.1 from
[package.json](package.json). If using `fnm`, follow its
[installation guide](https://github.com/Schniz/fnm#installation) first. Run the commands below from the
cloned repository's root.

```bash
# Clone this fork
git clone https://github.com/YukiWorks432/dualview.git
cd dualview

# Install and select the repository Node.js version with fnm
fnm install
fnm use

# Install dependencies
pnpm install --frozen-lockfile

# Start development server
pnpm dev

# Run formatting, linting, type checks, tests, and production build
pnpm check

# Build for production
pnpm build

# Preview production build
pnpm preview
```

Open the development URL printed in the terminal. `pnpm preview` serves the built `dist/` locally.

### Requirements

- Node.js 24.21.0 and pnpm 12.5.1 are the repository's selected versions.
- Declared engine minimums: Node.js 24.21.0 and pnpm 12.0.0.
- `fnm` is optional; the commands above use it to install and select the repository Node.js version.
- WebGL analysis needs WebGL 2.0.
- MP4 export needs WebCodecs `VideoEncoder`.
- Timeline difference analysis needs Worker and OffscreenCanvas.
- Current-frame difference regions need the frame-notification API. Comparison previews still update
  after loading and seeking without it.
- ProRes playback and timeline analysis use Mediabunny/TurboRes; native filmstrip and animated-export
  support follow the separate conditions described above.

### Development checks

`pnpm check` runs formatting, lint, type checking, unit tests, and the production build in order.
If one stage fails, fix that stage and run it again.

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `pnpm format:check` | Check Oxfmt formatting                       |
| `pnpm format`       | Apply formatting; inspect the resulting diff |
| `pnpm lint`         | Run Oxlint with type-aware checks            |
| `pnpm typecheck`    | Check TypeScript projects                    |
| `pnpm test:run`     | Run Vitest unit tests                        |
| `pnpm test`         | Run Vitest in watch mode                     |
| `pnpm build`        | Type-check and build with Vite               |
| `pnpm preview`      | Preview the built `dist/` locally            |

Browser tests run separately from `pnpm check`. Install Playwright's Chromium first:

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

CI installs from the frozen lockfile and runs quality checks and Chromium browser tests in separate
jobs. See the [CI workflow](.github/workflows/ci.yml), [Playwright configuration](playwright.config.ts),
and [browser test fixture guide](e2e/fixtures/README.md#english). The fixture guide documents sources,
generation commands, and historical measurements. Historical measurements do not show that a later
change passed its tests.

### Deployment

The maintained web app is deployed as Cloudflare Workers Static Assets at
[dualview.yukiworks432.workers.dev](https://dualview.yukiworks432.workers.dev). There is no
application Worker or backend API in the deployment path; Wrangler uploads the Vite `dist/` output
directly.

The production bundle does not include `ffmpeg.wasm`. Video export uses browser-native WebCodecs
and MediaRecorder paths plus gif.js, so the former `ffmpeg-core.wasm` asset-size constraint does
not apply to the deployed `dist/`.

Verify access to the intended Cloudflare account first. `pnpm deploy` changes the published app.

```bash
pnpm build
pnpm deploy
```

Wrangler is installed as a project dev dependency so local and Cloudflare builds use the locked CLI version.

`wrangler.jsonc` enables the production `workers.dev` route and leaves Custom Domain assignment
to the Cloudflare dashboard. This keeps optional custom domains reversible without a repository
change. Missing paths use the static `404.html` page instead of falling back to the application
shell.

Vite generates bundled-dependency notices in `dist/licenses/third-party.md`. Keep notices for vendored
or separately loaded code in [additional-notices.md](public/licenses/additional-notices.md).
For the full workflow, see [Development and deployment](docs/development.md#english).

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
│   ├── difference/        # Difference-analysis Worker and processing
│   ├── webgl/             # Comparison, scope, and transition renderers/shaders
│   ├── mp4Encoder.ts
│   ├── gifEncoder.ts
│   └── metrics.ts         # SSIM/PSNR calculation
└── types/                 # Shared types

public/                    # Static pages, fonts, bundled Worker, license notices
```

See [comparison modes](src/config/comparisonModes.ts), [timeline state](src/stores/timelineStore.ts),
[audio analysis](src/lib/audio), [media import](src/stores/mediaStore.ts), and
[filmstrip extraction](src/lib/filmstripExtractor.ts) when checking behavior against code.

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

The inherited browser baselines below are targets. They do not establish that every feature has been
tested in every listed version; feature availability also depends on the required browser APIs.

| Browser | Baseline target |
| ------- | --------------- |
| Chrome  | 111+            |
| Edge    | 111+            |
| Firefox | 114+            |
| Safari  | 16.4+           |

MP4 export additionally depends on the browser exposing the WebCodecs `VideoEncoder` API.
ProRes playback is decoded locally with Mediabunny/TurboRes; animated exports for ProRes are currently
disabled, while current-frame Image and PDF export remain available. WebGL analysis, timeline
analysis, and current-frame regions have the separate API requirements listed above. See the
[feature requirements](docs/user-guide.en.md#requirements).

---

## Guides

- [User guide](docs/user-guide.en.md): comparison modes, playback, timeline edits, projects, audio,
  exports, and shortcuts.
- [Analysis reference](docs/analysis-reference.md#english): all eight WebGL categories, interpretation
  limits, and transition/sweep effects.
- [Development and deployment](docs/development.md#english): setup, checks, architecture, dependency
  updates, and Cloudflare deployment.
- [Browser test fixtures](e2e/fixtures/README.md#english): source attribution, generation commands, and
  historical measurements.

---

<details>
<summary><strong>Cite this project</strong></summary>

This repository is a maintained fork of the original
[gokayfem/dualview](https://github.com/gokayfem/dualview) project. The citation metadata keeps
credit to original creator Gökay Aydoğan while identifying 花雪 / HanaYuki as the maintainer of this
fork.

If your work depends on this maintained fork, GitHub's **Cite this repository** action uses
[CITATION.cff](CITATION.cff). A matching BibTeX entry is:

```bibtex
@software{Aydogan_YukiWorks432_DualView_2026,
  author  = {Aydoğan, Gökay and {花雪 / HanaYuki}},
  title   = {DualView},
  version = {1.0.0},
  year    = {2026},
  url     = {https://dualview.yukiworks432.workers.dev},
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
**花雪 / HanaYuki**.

|                      | GitHub                                             | X                                       | Website                              |
| -------------------- | -------------------------------------------------- | --------------------------------------- | ------------------------------------ |
| **Original creator** | [gokayfem](https://github.com/gokayfem)            | [@gokayfem](https://x.com/gokayfem)     | [dualview.ai](https://dualview.ai)   |
| **Fork maintainer**  | [花雪 / HanaYuki](https://github.com/YukiWorks432) | [@YuK1_Works](https://x.com/YuK1_Works) | [hanayuki.xyz](https://hanayuki.xyz) |

## 📄 License

MIT License - see [LICENSE](LICENSE) for details. Browser-distributed dependency notices and
source links are published on the [Licenses page](https://dualview.yukiworks432.workers.dev/licenses/).

Contributions are welcome on this fork. Use [Issues](https://github.com/YukiWorks432/dualview/issues)
for bug reports and proposals, or [Pull requests](https://github.com/YukiWorks432/dualview/pulls) for
contributions. For private inquiries or personal information, use the
[maintainer's contact page](https://hanayuki.xyz/contact/).

[Privacy](https://dualview.yukiworks432.workers.dev/privacy/) ·
[Terms](https://dualview.yukiworks432.workers.dev/terms/) ·
[About](https://dualview.yukiworks432.workers.dev/about/)

---

<p align="center">
  <sub>Built with love for creators who care about every pixel</sub>
</p>
