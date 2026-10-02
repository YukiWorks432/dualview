# Browser test media

`quality-high.webm` and `quality-low.webm` are 1.5-second excerpts from NASA SVS's
[EOS - AM1 Beauty Shot](https://svs.gsfc.nasa.gov/0183), NASA ID 183. The excerpt starts at
4.5 seconds and retains the source's 640 × 480 resolution and approximately 29.97 fps timing.
NASA SVS states that its content is public domain unless a page says otherwise; the asset is
credited to NASA/Goddard Space Flight Center. These short derivatives are test fixtures only and
do not imply NASA endorsement.

The two fixtures use the same source frames with different VP9 settings to calibrate compression
noise at the default pixel and area thresholds. They were generated with native FFmpeg using:

```text
ffmpeg -ss 4.5 -i source.mp4 -t 1.5 -an -c:v libvpx-vp9 -deadline good -cpu-used 0 -crf 4 -b:v 0 -fps_mode passthrough quality-high.webm
ffmpeg -ss 4.5 -i source.mp4 -t 1.5 -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 40 -b:v 0 -fps_mode passthrough quality-low.webm
```

`pattern-quality-high.webm` and `pattern-quality-low.webm` are generated from the same
128 × 72, 8 fps `testsrc2` pattern using those VP9 quality settings. They exercise a detailed,
synthetic case where compression artifacts were more pronounced.

`long-quality-high.webm` and `long-quality-low.webm` are generated from the same 1280 × 720,
24 fps, 4-second `testsrc2` pattern. They contain 96 frame intervals and exercise the standard
640-pixel resize, full-resolution comparison, analysis cancellation, and zoomed or scrolled lane.
Their generation commands are:

```text
ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=24:duration=4" -an -c:v libvpx-vp9 -deadline good -cpu-used 4 -crf 4 -b:v 0 -fps_mode passthrough long-quality-high.webm
ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=24:duration=4" -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 40 -b:v 0 -fps_mode passthrough long-quality-low.webm
```

`duration-75s-a.webm` and `duration-75s-b.webm` are generated black 128 × 72, 24 fps clips with
1,800 frames. The B clip contains a single white frame at 30 seconds. This exercises analysis
across a longer sequence and confirms that a one-frame highlight remains visible when many later
unchanged intervals share its lane pixels at low zoom.

```text
ffmpeg -f lavfi -i "color=c=black:s=128x72:r=24:d=75" -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 30 -b:v 0 -fps_mode passthrough duration-75s-a.webm
ffmpeg -f lavfi -i "color=c=black:s=128x72:r=24:d=75" -vf "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(t,30,30.04)'" -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 30 -b:v 0 -fps_mode passthrough duration-75s-b.webm
```

At the default pixel threshold (0.10) and area threshold (2%), Chromium measured a maximum frame
difference of 0.01% across all 45 NASA frames. The generated pattern measured 2.73% at its peak and
is highlighted at the default area threshold; raising the area threshold to 5% removes that segment
without decoding again. This tests both a real-footage baseline and the threshold's noise trade-off;
footage with different content or compression may need different values.
The end-to-end suite also logs comparison time from **Analyze** to completion for both resolutions
on the 96-frame 1280 × 720 pattern. In one local Chromium run, standard resolution took 7.48 seconds
and full resolution took 7.47 seconds. These timings depend on the browser and machine.

The other tiny fixtures are generated black, white, or single-frame-change clips for deterministic
browser tests.

`playback-colors.webm` and `playback-colors.mov` are synthetic 64 × 64, 10 fps,
4-second fixtures: red before 2 seconds and blue afterwards. The WebM contains
440 Hz mono Opus audio at 48 kHz; the ProRes HQ MOV is silent. Playback tests inspect
actual decoded pixels and audio-source timing across seeks, clip boundaries and reloads.
They were generated using:

```text
ffmpeg -f lavfi -i "color=c=red:s=64x64:r=10:d=4" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=4" -vf "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(t,2)'" -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 4 -b:v 0 -c:a libopus playback-colors.webm
ffmpeg -f lavfi -i "color=c=red:s=64x64:r=10:d=4" -vf "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(t,2)'" -an -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le playback-colors.mov
```
