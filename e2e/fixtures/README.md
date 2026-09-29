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

At the default pixel threshold (0.10) and area threshold (2%), Chromium measured a maximum frame
difference of 0.01% across all 45 NASA frames. The generated pattern measured 2.73% at its peak and
is highlighted at the default area threshold; raising the area threshold to 5% removes that segment
without decoding again. This tests both a real-footage baseline and the threshold's noise trade-off;
footage with different content or compression may need different values.

The other tiny fixtures are generated black, white, or single-frame-change clips for deterministic
browser tests.
