<p align="center">
  <img src="public/favicon.svg" width="64" height="64" alt="DualView logo">
</p>

# DualView

Review images and videos before delivery in your browser. DualView combines synchronized A/B playback,
pixel and color analysis, embedded-video audio checks, and exportable comparison evidence.

[Open the app](https://dualview.yukiworks432.workers.dev) · [日本語](README.md) ·
[User guide](docs/user-guide.en.md) · [Development and deployment](docs/development.md#english)

![DualView displaying an A/B media comparison](https://github.com/user-attachments/assets/24a2b466-a9d9-4b0a-990a-66b47b308357)

## Start a comparison

1. Open the app and import your images or videos.
2. Place the sources on Track A and Track B. Align clip positions and trim points as needed.
3. Choose `Slider` to move an A/B boundary or `Side by Side` to view both sources. Play videos together,
   then pause to inspect individual frames.
4. Open `Difference` for visual analysis or `Audio QA` for audio embedded in the videos.
5. Export an image or PDF for review. Save a `.dualview` project to keep the editable comparison and media together.

Local media is processed in your browser without being uploaded to the operator. URL import connects
directly to the source URL. Projects are automatically stored in this browser; export a separate backup
of important work. See [Privacy and data handling](https://dualview.yukiworks432.workers.dev/privacy/).

## Review tools

| Task                                       | Tools                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Compare revisions, renders, or compression | 12 comparison modes, synchronized pan/zoom, frame stepping, loops, markers                |
| Inspect color and detail                   | WebGL analysis, SSIM/PSNR, Delta E, heatmaps, pixel inspection, loupe, scopes             |
| Find changes across a video                | A/B frame-difference lane and navigation between highlighted intervals                    |
| Check embedded audio                       | Waveform, loudness reference estimates, Sample Peak, RMS, phase correlation, stereo width |
| Share evidence                             | PNG/JPEG, PDF, MP4/WebM/GIF for native video, transitions, stitch exports                 |
| Continue an editing session                | Multiple projects, auto-save, `.dualview` import/export, templates, Undo/Redo             |

Typical uses include client revisions, retouching, grading, VFX, generated-media review, and upscaling
comparisons. Standalone audio, text/JSON, 3D models, and document comparison are outside this fork's scope.

## Guides

- [User guide](docs/user-guide.en.md): comparison modes, playback, timeline edits, projects, audio, exports, and shortcuts.
- [Analysis reference](docs/analysis-reference.md#english): the eight WebGL categories and interpretation limits.
- [Development and deployment](docs/development.md#english): setup, checks, architecture, dependency updates, and Cloudflare deployment.
- [Browser test fixtures](e2e/fixtures/README.md#english): sources, generation commands, and historical measurements.

Image and PDF exports support the current decoded ProRes frame. Animated video/GIF, transition, and
stitch exports require browser-native video decoding. MP4 also requires WebCodecs `VideoEncoder`.
Analysis results are reference information, not certification of quality or broadcast/platform compliance.

## Run locally

Use Node.js 24.21.0 from [.node-version](.node-version) and pnpm 12.5.1 from [package.json](package.json).
If using `fnm`, follow its [installation guide](https://github.com/Schniz/fnm#installation) first.

```bash
git clone https://github.com/YukiWorks432/dualview.git
cd dualview
fnm install
fnm use
pnpm install --frozen-lockfile
pnpm dev
```

Open the development URL printed in the terminal. Run `pnpm check` for the aggregate quality gate,
`pnpm build` for production output, and `pnpm preview` to inspect that output locally.

The inherited browser baseline targets are Chrome 111+, Edge 111+, Firefox 114+, and Safari 16.4+.
These are targets, not proof that every feature has been tested in every listed version. Features
also depend on APIs such as WebGL 2.0, WebCodecs, Worker, and OffscreenCanvas. ProRes playback uses
Mediabunny/TurboRes. See the [feature requirements](docs/user-guide.en.md#requirements).

## Project lineage and credits

[Gökay Aydoğan](https://github.com/gokayfem) created the original
[gokayfem/dualview](https://github.com/gokayfem/dualview) project and [dualview.ai](https://dualview.ai).
[花雪 / HanaYuki](https://github.com/YukiWorks432) maintains and develops this fork and its public site.

- Original creator: [X](https://x.com/gokayfem), [Hugging Face](https://huggingface.co/gokaygokay), [ORCID](https://orcid.org/0000-0002-2343-9433)
- Fork maintainer: [hanayuki.xyz](https://hanayuki.xyz), [X](https://x.com/YuK1_Works)
- Citation: GitHub's `Cite this repository` uses [CITATION.cff](CITATION.cff); a [BibTeX example](docs/development.md#citation) is also available.

## License and contact

DualView is published under the [MIT License](LICENSE). The
[Licenses page](https://dualview.yukiworks432.workers.dev/licenses/) provides dependency notices and corresponding source links.

Use [Issues](https://github.com/YukiWorks432/dualview/issues) for bug reports and proposals, or
[Pull requests](https://github.com/YukiWorks432/dualview/pulls) for contributions. For private inquiries
or personal information, use the [maintainer's contact page](https://hanayuki.xyz/contact/).

[Privacy](https://dualview.yukiworks432.workers.dev/privacy/) ·
[Terms](https://dualview.yukiworks432.workers.dev/terms/) ·
[About](https://dualview.yukiworks432.workers.dev/about/)
