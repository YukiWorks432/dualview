# User guide

[README](../README.en.md) · [日本語](user-guide.md) · [Analysis reference](analysis-reference.md#english)

Place images or videos on Track A and Track B to review them together. This guide covers preparation,
playback, editing, analysis, project storage, and exports. Names in code formatting match the interface.

## Prepare media

Import through file selection, drag and drop, image paste, or URL. Local files are copied into an
independent browser-owned file before processing. URL import connects directly to the entered URL;
other local media already loaded into DualView is not sent there.

Removing a source, clearing the media list, or creating/loading a project invalidates affected imports
and retries. Their late results cannot add media or clips. Unused object URLs and decoding resources
are released. Closing the URL import dialog cancels its request.

## Comparison modes

| Mode          | Key | Use                                                                    |
| ------------- | --- | ---------------------------------------------------------------------- |
| Slider        | `1` | Move a boundary to reveal A or B                                       |
| Side by Side  | `2` | Display synchronized sources together                                  |
| Difference    | `3` | Inspect differences, color, and structure with WebGL                   |
| Audio QA      | `4` | Review audio embedded in the current videos                            |
| Split Screen  | —   | Use a multi-panel layout                                               |
| Quad View     | —   | Compare in four panels                                                 |
| Blend Modes   | —   | Composite with Difference, Overlay, Multiply, Screen, and other blends |
| Flicker       | —   | Alternate A/B rapidly                                                  |
| Heatmap       | —   | Visualize pixel and alpha differences                                  |
| Radial Loupe  | —   | Magnify a circular comparison area                                     |
| Grid Tile     | —   | Alternate sources in a checkerboard                                    |
| Morphological | —   | Inspect differences with morphological operations                      |

Pixel inspection, loupe, SSIM/PSNR, and Delta E provide additional ways to inspect detail. Toggle
scopes with `G`: Histogram shows RGB/luma distributions, Color Wheel shows chrominance, and Gamut
Warning highlights out-of-gamut pixels. See the [analysis reference](analysis-reference.md#english)
for WebGL categories and limitations.

## Playback and alignment

Transport controls share one playback clock. Repeated `J` or `L` presses select 1×, 2×, 4×, then 8× in
that direction. `Space` pauses/resumes without changing direction; `K` stops and restores 1× forward.
Selecting a speed also selects forward playback. Reverse shuttle is silent because reverse audio is
not synthesized.

Use `←`/`→` to step frames when paused or seek one second when playing. Add `Shift` to seek five
seconds. `Home` goes to the start; `End` stops on the final timeline frame. Set loop boundaries with
`I`/`O`; loops wrap in either direction. Paused seeks and marker jumps refresh native and ProRes frames.

## Edit clips

Align source timing with clip placement and trim points. Clips can be split, duplicated, copied, and
pasted. Constant playback speed and reverse settings survive these edits. Ripple editing moves later
clips on the same track when a clip's duration changes.

Replacing media preserves the clip position and source trim in-point, then uses the replacement's
remaining duration. If the replacement ends before that in-point, DualView explains the problem and
retains the previous edit.

### Keyframes

Saved projects can contain keyframes. Duplicate and paste retain relative times and interpolation;
end trims and keep-left edits retain keyframes outside the remaining interval. Undo/Redo restores them
with the clip.

Splitting, trimming the start, and keeping only the right side are unavailable for keyframed clips
because the time-remapping contract is undefined. Those operations explain the restriction and retain
the data.

### Filmstrips

The timeline samples at one-second intervals, up to 60 thumbnails. Extraction continues through clip
moves, trims, and view toggles. Matching media/settings reuse extracted frames; failed extraction falls
back to ordinary thumbnails. Removing or replacing media discards pending extraction and cached results.

Filmstrip extraction uses native browser video decoding. ProRes thumbnails therefore depend on native
browser support, independently of the ProRes decoder used for the comparison preview.

## Find differences

### Timeline analysis

Place A/B videos, then run `Analyze` in the timeline. Click the resulting difference lane to seek, or
use its previous/next controls to visit highlighted intervals. Adjust thresholds and resolution as needed.

A dedicated Worker maps encoded frame timestamps through clip trims, playback speed, and reverse
playback, then decodes and compares them with Mediabunny. This includes ProRes and does not seek or pause
the shared preview. Image clips are not supported by this video-frame analysis.

| Setting                       | Meaning                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Standard resolution           | Compare with a maximum long edge of 640 pixels                               |
| Full                          | Compare at source display dimensions; memory use can be substantially higher |
| Pixel threshold, default 0.10 | Difference needed to classify an individual pixel as changed                 |
| Area threshold, default 2%    | Changed-pixel proportion needed to highlight an interval                     |

Transparent pixels are compared by visible color and opacity; hidden RGB differences between two fully
transparent pixels do not count. Missing frames, A/B gaps, unsupported media, and decode errors are
separate from “no difference.” The lane also distinguishes analyzed and not-yet-analyzed intervals.

Results live only in the current browser session. Project, timeline, media, pixel-threshold, or
resolution changes discard them. Changing only the area threshold updates highlights from existing
frame scores without decoding again.

### Current-frame regions

`Slider` and `Side by Side` outline local A/B differences while paused. This is enabled by default and
can be disabled. Seeking or stepping invalidates the previous result; analysis resumes once both new
frames are ready. Playback hides the rectangles and stops this analysis path.

The detector uses the timeline analysis's pixel semantics and groups connected changed pixels into
rectangles. Sensitivity, small-region filtering, and automatic/full common-resolution analysis are
adjustable separately. The interactive SVG overlays are not included in image or video exports.

## Review embedded audio

`Audio QA` analyzes the primary audio track inside Track A/B videos. Playback follows clip placement,
trim in-points, and speed. Standalone audio import is not supported.

| Measurement            | Interpretation                                             |
| ---------------------- | ---------------------------------------------------------- |
| Integrated loudness    | Estimate for the full decoded source file                  |
| Tail 400 ms / Tail 3 s | The source's final 400 ms / 3 s, not live playhead meters  |
| Sample Peak            | Maximum decoded sample level, not standards-compliant dBTP |
| RMS                    | Root mean square level                                     |
| Phase correlation      | Stereo phase relationship                                  |
| Stereo width           | Mid/side-derived width indicator                           |

Reference targets include Spotify, YouTube, Apple Music, EBU R128 (-23 LUFS), and ATSC A/85 (-24 LUFS).
The ±1 LU indicator is a comparison aid, not certification of platform or broadcast compliance.
Analysis refuses decoded PCM estimates above 512 MiB and explains why, limiting memory pressure from
long or high-channel-count sources.

## Save and switch projects

Projects and media are stored in IndexedDB. Auto-save waits 500 ms after save-relevant edits to group
writes. It includes persisted comparison, scope, export, and timeline settings, title/description/tags,
media replacements, and keyframes.

The indicator remains unsaved while newer changes are pending, shows the latest write in progress, and
reports write failures. Playback position is included in the next save for restoration. Playback ticks,
analysis progress, pointer information, and selection changes alone do not schedule writes.

Creating or opening another project first saves outgoing edits. The current project remains available
until the destination is read and decoded. Failures retain current edits/media and appear in Projects
for retry. If switches overlap, only the latest request may become active.

Opening, creating, or deleting the active project resets Undo/Redo, selections, clip/keyframe
clipboards, and playback. Undo/Redo remains available within the current project editing session.
Projects can be duplicated or deleted; built-in and custom templates are also supported.

A `.dualview` project is JSON containing the media itself. Sharing it shares those sources too.
Clearing browser site data removes saved work, so export important projects before doing so.

## Export

Press `E` to open export settings and select the output format and source.

| Output            | Options and conditions                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Image             | PNG/JPEG; 720p, 1080p, 4K; comparison, A only, B only; JPEG quality and clipboard copy   |
| PDF               | Comparison reports, including the current decoded ProRes frame                           |
| Video/GIF         | MP4/WebM/GIF; 720p, 1080p, 4K; 24/30/60 fps; Low/Medium/High; comparison, A only, B only |
| Transition/stitch | WebGL transitions and composed comparison sequences                                      |

Animated video/GIF, transition, and stitch exports require browser-native video decoding. ProRes is
rejected on these paths rather than exporting stale or incorrect frames. MP4 requires `VideoEncoder`;
MP4 and GIF do not require WebM support. GIF uses the bundled local encoding Worker.

Use `Cancel` to stop an animated export. Cancellation and failure release resources before another
export starts. Borrowed preview videos return to their paused position. See the
[transition and sweep reference](analysis-reference.md#transitions) for effect families.

## Shortcuts

| Action                                      | Keys                                      |
| ------------------------------------------- | ----------------------------------------- |
| Play/pause                                  | `Space`                                   |
| Paused frame step / playing one-second seek | `←` / `→`                                 |
| Five-second seek                            | `Shift` + `←` / `→`                       |
| Reverse / stop / forward shuttle            | `J` / `K` / `L`                           |
| Start / final frame                         | `Home` / `End`                            |
| Loop in / out / clear                       | `I` / `O` / `Escape`                      |
| Add marker                                  | `M`                                       |
| Primary comparison modes                    | `1`–`4`                                   |
| Flip A/B in Difference                      | `F`                                       |
| Focus Peaking / Zebra / scopes              | `P` / `Z` / `G`                           |
| Split selected clip                         | `S`                                       |
| Keep left / right of playhead               | `Q` / `W`                                 |
| Ripple editing / snapping                   | `R` / `N`                                 |
| Delete selected clips                       | `Delete`                                  |
| Timeline / sidebar                          | `T` / `B`                                 |
| Export dialog                               | `E`                                       |
| Screenshot / metrics overlay                | `Shift` + `S` / `Shift` + `M`             |
| Undo / redo                                 | `Ctrl/⌘` + `Z` / `Ctrl/⌘` + `Shift` + `Z` |
| Save project                                | `Ctrl/⌘` + `S`                            |
| Shortcut help                               | `?`                                       |

In `Audio QA`, `A`, `B`, and `S` select Track A, Track B, and both tracks. `B` and `S` also have sidebar and clip-editing assignments; use the on-screen audio buttons to select the intended action explicitly. Inputs, dialogs, and active drags have their own key
handling; `Escape` also dismisses dialogs or cancels a drag.

## Requirements

- WebGL analysis needs WebGL 2.0.
- MP4 export needs WebCodecs `VideoEncoder`.
- Timeline difference analysis needs Worker and OffscreenCanvas.
- Current-frame difference regions need the frame-notification API. Without it, comparison previews
  still update after loading and seeking.
- ProRes playback and timeline analysis use Mediabunny's ProRes decoder. Filmstrip and animated-export
  support follow the separate conditions described above.

Heatmap separates single-frame drawing from the playback loop and reuses input canvases and output pixel arrays. While paused, it updates only for frame, setting, or display-size changes. WebGL Split View's central
analysis uses the same sources, position, trims, speed, and reverse settings as its sides. Repeated
seeks apply the latest request after an active seek completes; gaps and waiting frames do not retain
stale analysis. Only flicker detection and the two zebra animations continuously redraw while paused.
Leaving a comparison view cancels pending drawing and releases scratch buffers.

## Implementation references

See [comparison modes](../src/config/comparisonModes.ts), [timeline state](../src/stores/timelineStore.ts),
[audio analysis](../src/lib/audio), [media import](../src/stores/mediaStore.ts), and
[filmstrip extraction](../src/lib/filmstripExtractor.ts) when checking these behaviors against code.
