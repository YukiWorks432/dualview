# DualView

DualView is an open-source A/B comparison tool for **image and video delivery review**. This maintained fork focuses on finding unintended visual or audio changes before a render or revision is delivered.

The application runs locally in the browser. Imported media stays on the user's device unless a browser feature explicitly requires otherwise.

## Focus

The maintained fork intentionally narrows DualView to two source types:

- **Images** — compare renders, stills, graphics, and revised assets.
- **Videos** — compare revisions with synchronized playback, frame stepping, visual analysis, and **audio QA for the audio embedded in the videos**.

Standalone audio files, prompts/JSON, 3D models, CSV/Excel/DOCX/PDF documents, and their dedicated comparison modes are intentionally out of scope.

## Comparison tools

Core modes:

| Mode | Shortcut | Purpose |
| --- | --- | --- |
| Slider | `1` | Wipe between A and B |
| Side by Side | `2` | View both revisions simultaneously |
| Difference | `3` | GPU-accelerated visual difference analysis |
| Audio QA | `4` | Analyze audio embedded in the current A/B videos |

Additional visual modes include Blend, Flicker, Heatmap, Split Screen, Quad View, Radial Loupe, Grid Tile, and Morphological analysis.

The WebGL analysis engine includes perceptual and absolute differences, SSIM-oriented structural analysis, edge and gradient inspection, exposure tools, temporal analysis, and other diagnostics useful for render QA.

## Video delivery review

Video comparison includes:

- synchronized A/B playback
- frame stepping and seeking
- loop ranges and shuttle controls
- ProRes decoding through Mediabunny where browser-native playback is unavailable
- SSIM / PSNR quality metrics
- pixel inspection and zoom/pan tools
- waveform, loudness, phase, stereo-width, RMS, peak, and LUFS analysis for embedded video audio
- scopes and exposure-oriented inspection tools

Audio QA is deliberately tied to the current video sources. DualView no longer treats standalone audio as a separate media workflow.

## Development

Requirements:

- Node.js 22.12 or newer
- pnpm 12

```bash
pnpm install
pnpm dev
```

Run the full validation suite with:

```bash
pnpm check
```

Production build:

```bash
pnpm build
```

The maintained deployment is configured for Cloudflare Workers static assets and uses:

- https://dualview.hanayuki.xyz

## Project lineage

This repository is a maintained fork of the original DualView project by **Gökay Aydoğan**.

### Maintained fork

- GitHub: https://github.com/YukiWorks432/dualview
- X: https://x.com/YuK1_Works
- Website: https://hanayuki.xyz

### Original project

- GitHub: https://github.com/gokayfem/dualview
- Original website: https://dualview.ai
- Hugging Face: https://huggingface.co/gokaygokay

The goal of this fork is to preserve the original project's useful A/B comparison work while reducing the feature surface and maintenance cost around workflows unrelated to image/video delivery review.

## License

MIT. See [LICENSE](./LICENSE).

Attribution for the original project is retained in the repository metadata and [CITATION.cff](./CITATION.cff).
