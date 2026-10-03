# ブラウザーテストの素材

[開発ガイド](../../docs/development.md) · [English](#english)

このディレクトリには、差分解析と再生をブラウザー上で検証する短い動画を置く。
実映像の圧縮差と、結果を予測できる合成映像を使い分ける。
以下の生成コマンドは、素材を作成した際の記録。通常のテスト実行前に再生成する必要はない。

## 素材と検証する動作

| ファイル                                                 | 内容                                                              | 主な確認対象                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `quality-high.webm` / `quality-low.webm`                 | NASA映像の同じ45フレームを異なるVP9設定で圧縮                     | 実映像の圧縮ノイズと既定しきい値                                        |
| `pattern-quality-high.webm` / `pattern-quality-low.webm` | 128×72、8 fpsの`testsrc2`                                         | 細部のある合成映像の圧縮差                                              |
| `long-quality-high.webm` / `long-quality-low.webm`       | 1280×720、24 fps、4秒の`testsrc2`。96フレーム区間                 | 長辺640画素への縮小、全解像度、解析中止、拡大・スクロール後の差分レーン |
| `duration-75s-a.webm` / `duration-75s-b.webm`            | 128×72、24 fps、75秒、1,800フレーム。Bだけ30秒位置に白い1フレーム | 長い区間と低倍率表示でも単一フレームの強調が残ること                    |
| `playback-colors.webm` / `playback-colors.mov`           | 64×64、10 fps、4秒。2秒より前は赤、以降は青                       | シーク、クリップ境界、再読み込み後の実デコード画素と音声開始時刻        |

`playback-colors.webm`には48 kHz・440 HzのモノラルOpus音声を含む。
ProRes HQの`playback-colors.mov`は無音。ほかの小さな素材は、黒、白、1フレームだけの変化を合成したもの。

## NASA映像の出典と生成

出典はNASA SVSの[EOS - AM1 Beauty Shot](https://svs.gsfc.nasa.gov/0183)（NASA ID 183）。
4.5秒位置から1.5秒を抜き出し、640×480、約29.97 fpsの時刻情報を保っている。
NASA SVSは、各ページで別途指定がない限りコンテンツをパブリックドメインとしている。
クレジットはNASA/Goddard Space Flight Center。これらの派生素材は試験専用であり、NASAの推奨を示すものではない。

`source.mp4`は取得した元映像のローカルファイル名。ネイティブFFmpegを用い、出力先の同名ファイルを確認してから実行する。

```text
ffmpeg -ss 4.5 -i source.mp4 -t 1.5 -an -c:v libvpx-vp9 -deadline good -cpu-used 0 -crf 4 -b:v 0 -fps_mode passthrough quality-high.webm
ffmpeg -ss 4.5 -i source.mp4 -t 1.5 -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 40 -b:v 0 -fps_mode passthrough quality-low.webm
```

## 合成素材の生成記録

128×72・8 fpsのパターンには、NASA素材と同じVP9の高画質・低画質設定を使っている。
1280×720・96フレームのパターンは次のコマンドで生成した。

```text
ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=24:duration=4" -an -c:v libvpx-vp9 -deadline good -cpu-used 4 -crf 4 -b:v 0 -fps_mode passthrough long-quality-high.webm
ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=24:duration=4" -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 40 -b:v 0 -fps_mode passthrough long-quality-low.webm
```

75秒の素材は、黒一色のAと、30秒位置に白い1フレームを加えたBで構成する。

```text
ffmpeg -f lavfi -i "color=c=black:s=128x72:r=24:d=75" -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 30 -b:v 0 -fps_mode passthrough duration-75s-a.webm
ffmpeg -f lavfi -i "color=c=black:s=128x72:r=24:d=75" -vf "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(t,30,30.04)'" -an -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 30 -b:v 0 -fps_mode passthrough duration-75s-b.webm
```

再生検証用のWebMとProRes HQ MOVは次のとおり。

```text
ffmpeg -f lavfi -i "color=c=red:s=64x64:r=10:d=4" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=4" -vf "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(t,2)'" -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 4 -b:v 0 -c:a libopus playback-colors.webm
ffmpeg -f lavfi -i "color=c=red:s=64x64:r=10:d=4" -vf "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(t,2)'" -an -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le playback-colors.mov
```

## 過去の測定記録

次の値は素材を導入した際のChromiumでの測定記録であり、性能保証や最新のテスト結果ではない。
元の記録にはブラウザー版と端末仕様が残っていないため、再現時の基準値として固定しない。

- 画素のしきい値0.10、面積のしきい値2%で、NASA素材45フレームの差分割合の最大値は0.01%だった。
- 小さい合成パターンの最大値は2.73%。既定値では強調され、面積のしきい値を5%へ上げると、再デコードせず強調が消えた。
- 1280×720・96フレームのパターンについて、あるローカル実行では`Analyze`から完了まで標準解像度7.48秒、全解像度7.47秒だった。

テストは両解像度の処理時間も記録する。映像の内容・圧縮、ブラウザー、端末が変われば差分割合や所要時間も変わる。

<h2 id="english">English: browser test media</h2>

These short videos exercise frame differences and playback. Real footage provides a compression-noise
baseline; generated clips make specific pixel changes predictable. The commands above record fixture
creation and do not need to run before an ordinary test. Use native FFmpeg; check output filenames before regenerating.

### Sources and fixture roles

`quality-high.webm` and `quality-low.webm` use the same 1.5-second excerpt from NASA SVS's
[EOS - AM1 Beauty Shot](https://svs.gsfc.nasa.gov/0183), NASA ID 183, starting at 4.5 seconds.
They retain 640×480 resolution and approximately 29.97 fps timing. NASA SVS describes its content as
public domain unless otherwise stated. Credit: NASA/Goddard Space Flight Center. These test-only
derivatives do not imply NASA endorsement. In the first command pair, `source.mp4` is the local source video.

The two VP9 settings calibrate compression noise. `pattern-quality-high.webm` and
`pattern-quality-low.webm` apply the same quality settings to a 128×72, 8 fps `testsrc2` pattern with
more pronounced artifacts. `long-quality-high.webm` and `long-quality-low.webm` use a 1280×720, 24 fps,
four-second pattern: 96 intervals for standard 640-pixel resizing, full resolution, cancellation, and
zoomed/scrolled lane tests. The second command pair generates these longer patterns.

`duration-75s-a.webm` and `duration-75s-b.webm` contain 1,800 frames at 128×72 and 24 fps. A is black;
B adds one white frame at 30 seconds. The third command pair creates this test of a one-frame highlight
remaining visible at low zoom while many later unchanged intervals share its lane pixels.

`playback-colors.webm` and `playback-colors.mov` are 64×64, 10 fps, four-second clips: red before two
seconds, blue afterwards. WebM contains 440 Hz mono Opus audio at 48 kHz; the ProRes HQ MOV is silent.
The final command pair creates them. Tests inspect decoded pixels and audio-source timing through
seeks, clip boundaries, and reloads. Other tiny fixtures are generated black, white, or single-change clips.

### Historical measurements

These are recorded Chromium observations, not current test results or performance guarantees. The
original record did not identify the browser version or machine, so do not treat them as fixed reproduction targets.

At pixel threshold 0.10 and area threshold 2%, the maximum difference over the 45 NASA frames was 0.01%.
The small pattern peaked at 2.73%; it was highlighted at 2%, and raising the area threshold to 5%
removed that highlight without decoding again. Content and compression can require other thresholds.

The suite also logs time from `Analyze` to completion for both resolutions of the 96-frame 1280×720
pattern. One local run recorded 7.48 seconds at standard resolution and 7.47 seconds at full resolution.
Timing depends on the browser and machine.
