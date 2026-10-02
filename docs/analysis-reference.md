# 解析・書き出しリファレンス

[README](../README.md) · [利用ガイド](user-guide.md) · [English](#english)

## WebGL解析の使い分け

`Difference`の解析は8分類から選ぶ。見たい違いに合わせて表示方法を選び、必要に応じて増幅やしきい値を調整する。
表示名や内部識別子は[型定義](../src/types/index.ts)と[解析シェーダー](../src/lib/webgl/comparison-shaders)で確認できる。
数値や疑似色だけで合否を決めず、元のA/B表示と併せて判断する。

| 分類                 | 主な表示と用途                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Difference           | AbsoluteでRGB差分、PerceptualでLAB色空間のDelta E、Luminanceで明るさ、Chromaで色成分を比較する。Thresholdは二値化、Amplifiedは小さな差の強調に使う。縦・横のWipe、50/50のSplit、テクスチャ確認用Debugも含む |
| Structural           | SSIM Mapで局所的な構造の類似度、Edge ComparisonでSobelエッジの差、Gradientで勾配の大きさ、Local Contrastで局所的なコントラスト、Block Differenceでブロック単位の差を調べる                                  |
| Color                | Hue Difference、Saturation Map、False Color、Channel Split、Histogram Overlayで、色相、彩度、差の疑似色表示、RGB各成分、分布を確認する                                                                      |
| Professional         | Anaglyph 3D、Checkerboard、Onion Skin、Loupe Wipe、Frequency Split、Difference Maskで、赤・シアンの重ね合わせ、市松模様、半透明合成、拡大、周波数成分、差分のマスクを使い分ける                             |
| Video                | Temporal Diff、Motion Vectors、Flicker Detection、Frame Blendで、時間方向の変化、動きの近似、ちらつき、フレームの混合を確認する                                                                             |
| Perceptual Weighting | Saliency、Edge Weighted、Weighted SSIMで、視覚的な注目度やエッジを重み付けに使う                                                                                                                            |
| Advanced Analysis    | 複数尺度のエッジ、局所コントラスト、勾配方向、方向ヒストグラム、Optical Flow、FFT表示、帯域フィルター、ノイズ、差分蓄積を調べる                                                                             |
| Exposure             | False Color、Focus Peaking、Zebra Stripes、Zone Systemで露出や輪郭を確認する。各表示にA/B比較版がある                                                                                                       |

### 高度な解析の読み方

Multi-scale Edgeはラプラシアンピラミッドによるエッジ比較、Local Contrastは局所標準偏差の表示。
Gradient Directionは勾配の方向を色相へ対応させ、Direction Histogramは方向の分布を示す。
Optical Flowはブロック単位の動きの近似で、8×8・16×16・32×32の粒度を扱う。

FFT Magnitudeはラプラシアンに基づく近似表示、FFT Phaseは勾配方向に基づく表示である。
厳密な離散フーリエ変換の測定結果として扱わない。
Band-pass Filterには低域、高域、帯域の選択肢があり、構造と細部・ノイズを見分ける補助になる。

Temporal NoiseとNoise Varianceは時間変化と空間的なばらつきを示す。
Diff Accumulatorには最大値、平均値、減衰する動き履歴の表示がある。
時間方向の表示は、取り込まれたフレーム履歴の影響を受ける。

### 露出とスコープ

Focus Peakingは鋭いエッジを強調し、`P`で切り替える。
Zebra Stripesは100 IREの過露出の目安を示し、`Z`で切り替える。
Zone Systemは0〜Xの露出区分、False Colorは露出レベルを疑似色で示す。
別途`G`で表示するスコープには、RGB・輝度ヒストグラム、色度を示すColor Wheel、色域外警告がある。

<h2 id="transitions">書き出しの切り替え効果とスイープ</h2>

トランジションは、比較動画を書き出す際の切り替え表現として使う。
分類と全バリエーションは[シェーダー一覧](../src/lib/webgl/shaders/index.ts)を参照。
個数は更新されるため、ここでは用途で分類する。

| 分類 / Family | 表現 / Effect                                                                  |
| ------------- | ------------------------------------------------------------------------------ |
| Crossfade     | 画像を混ぜながら切り替える / Blend between sources                             |
| Dissolve      | ノイズ、粉、インクなどで移り変わる / Noise, powder, ink, and related dissolves |
| Wipe          | 方向や形状に沿って境界を動かす / Directional and shaped reveals                |
| Zoom          | 拡大・縮小で移り変わる / Scale, push, pull, and zoom                           |
| Blur          | ぼかしを使う / Gaussian, motion, radial, and related blurs                     |
| Rotate        | 回転・反転する / Rotate, flip, cube, and fold                                  |
| Light         | 光漏れや発光を使う / Light leaks, glow, and flare                              |
| Prism         | 色収差や虹色を使う / Chromatic and rainbow effects                             |
| Glitch        | デジタル的な乱れを使う / Digital distortion                                    |
| Morph         | 形を変形させる / Shape transformations                                         |
| Pixelate      | モザイクや低解像度風に切り替える / Mosaic, dither, and retro pixel effects     |
| Refraction    | ガラスや水のようにゆがめる / Glass, water, and lens distortion                 |
| Shutter       | 動きや残像を使う / Motion lines, echoes, and trails                            |
| Stylized      | 様式化した表現を使う / Kaleidoscope, film burn, and other artistic effects     |

スイープにはHorizontal、Vertical、Diagonal、Circle、Rectangle、Spotlight、Spotlight Circleがある。
順に、横、縦、斜め、広がる円、広がる矩形、跳ね返る矩形、跳ね返る円でA/Bを見せる。
利用できる入力形式と中止時の動作は[書き出しガイド](user-guide.md#export)を参照。

<h2 id="english">English: analysis reference</h2>

Choose a `Difference` view by the kind of change you need to inspect, then adjust amplification and
thresholds. Check the original A/B images alongside metrics and false-color views. Analysis supports
review; it does not certify quality or compliance.

| Category             | Views and purpose                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Difference           | Absolute compares RGB; Perceptual uses Delta E in LAB; Luminance isolates brightness; Chroma isolates color. Threshold produces a binary mask, Amplified magnifies small changes, vertical/horizontal Wipe and Split reveal A/B, and Debug displays a texture |
| Structural           | SSIM Map visualizes local similarity; Edge Comparison uses Sobel edges; Gradient compares magnitudes; Local Contrast compares local contrast; Block Difference compares blocks                                                                                |
| Color                | Hue Difference, Saturation Map, False Color, Channel Split, and Histogram Overlay inspect hue, saturation, difference amplitude, individual RGB channels, and distributions                                                                                   |
| Professional         | Anaglyph 3D, Checkerboard, Onion Skin, Loupe Wipe, Frequency Split, and Difference Mask offer red/cyan, tiled, translucent, magnified, frequency-separated, and masked comparisons                                                                            |
| Video                | Temporal Diff, Motion Vectors, Flicker Detection, and Frame Blend inspect changes over time, approximate motion, instability, and temporal blending                                                                                                           |
| Perceptual Weighting | Saliency, Edge Weighted, and Weighted SSIM apply attention- or edge-based importance                                                                                                                                                                          |
| Advanced Analysis    | Multi-scale edges, local contrast, gradient direction, direction histogram, optical flow, FFT displays, band-pass filters, noise, and accumulated differences                                                                                                 |
| Exposure             | False Color, Focus Peaking, Zebra Stripes, and Zone System, each with an A/B comparison variant                                                                                                                                                               |

Multi-scale Edge uses a Laplacian pyramid; Local Contrast displays local standard deviation.
Gradient Direction maps orientation to hue, and Direction Histogram shows its distribution. Optical
Flow approximates motion in blocks, including 8×8, 16×16, and 32×32 sizes.

FFT Magnitude is a Laplacian-based approximation, and FFT Phase is based on gradient direction. They
are not exact discrete Fourier-transform measurements. Low-, high-, and band-pass filters help
separate structure from detail/noise. Temporal Noise and Noise Variance inspect temporal changes and
spatial variance. Difference accumulation offers maximum, average, and decaying motion-history views;
temporal displays depend on the frame history supplied to them.

Focus Peaking highlights sharp edges (`P`). Zebra Stripes indicate the 100 IRE overexposure reference
(`Z`). Zone System uses zones 0–X, and False Color visualizes exposure levels. Separate scopes (`G`)
show RGB/luma histograms, Color Wheel chrominance, and gamut warnings.

Transition families are listed in the bilingual [transition table](#transitions). Sweep options are
Horizontal, Vertical, Diagonal, Circle, Rectangle, Spotlight, and Spotlight Circle: directional reveals,
expanding shapes, or bouncing rectangles/circles. See [export requirements](user-guide.en.md#export).

The [type definitions](../src/types/index.ts), [comparison shaders](../src/lib/webgl/comparison-shaders),
and [transition registry](../src/lib/webgl/shaders/index.ts) are the references for exact identifiers and variants.
