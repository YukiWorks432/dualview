<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="DualViewのロゴ">
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
    原作者: <a href="https://github.com/gokayfem"><strong>Gökay Aydoğan</strong></a>
    · <a href="https://github.com/gokayfem/dualview">原リポジトリ</a>
    · <a href="https://dualview.ai">原サイト</a>
    · <a href="https://x.com/gokayfem">@gokayfem</a>
    · <a href="https://huggingface.co/gokaygokay">Hugging Face</a>
  </sub>
</p>

<p align="center">
  <strong>画像・動画の納品前レビューを支える比較ツール</strong>
</p>

<p align="center">
  画像と動画を並べて、納品前の変更や意図しない差分を確認するブラウザーアプリ。<br>
  A/B同期再生 • GPU解析 • ProRes再生 • フレーム単位の確認 • 音声QA • 比較結果の書き出し
</p>

<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/24a2b466-a9d9-4b0a-990a-66b47b308357" alt="A/Bの素材を比較するDualViewのデモ" width="100%">
</p>

<br>

<p align="center">
  <a href="#features">機能</a> •
  <a href="#comparison-modes">比較表示</a> •
  <a href="#webgl-analysis">解析</a> •
  <a href="#export">書き出し</a> •
  <a href="#shortcuts">操作</a> •
  <a href="#getting-started">導入</a> •
  <a href="#project-lineage">原プロジェクト</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.3.0-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-7.0.2-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-8.3.0-646CFF?style=flat-square&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/WebGL-GPU_Accelerated-990000?style=flat-square&logo=webgl" alt="WebGL">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

<p align="center">
  <a href="README.en.md">English</a> ·
  <a href="docs/user-guide.md">利用ガイド</a> ·
  <a href="docs/analysis-reference.md">解析リファレンス</a> ·
  <a href="docs/development.md">開発・公開手順</a>
</p>

---

## 比較を始める

1. アプリを開き、比較する画像または動画を読み込む。
2. 素材をTrack AとTrack Bに配置し、必要に応じて開始位置やトリムをそろえる。
3. `Slider`で境界を動かすか、`Side by Side`で両方を表示する。動画は同期再生し、停止してフレームごとの差を確認する。
4. 詳細を調べる場合は`Difference`、動画の音声を調べる場合は`Audio QA`を選ぶ。
5. 比較結果を画像やPDFに書き出す。編集を引き継ぐ場合は、素材を含む`.dualview`ファイルを保存する。

ローカル素材はブラウザー内で処理され、運営者へアップロードされない。
URLからの取り込みでは取得先へ直接通信する。プロジェクトはこのブラウザーに自動保存されるため、
重要な作業は別途書き出して保管する。詳しくは[データの取り扱い](https://dualview.yukiworks432.workers.dev/privacy/)を参照。

---

<h2 id="project-lineage">原プロジェクトとこのフォーク</h2>

> [!NOTE]
> DualViewの原作者は[Gökay Aydoğan](https://github.com/gokayfem)。原プロジェクトは
> [gokayfem/dualview](https://github.com/gokayfem/dualview)である。
> このフォークは[花雪 / HanaYuki](https://github.com/YukiWorks432)が、原作者への帰属を保ちながら、
> 技術基盤の更新、保守、継続開発を行っている。

| 役割             | リンク                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 原プロジェクト   | [gokayfem/dualview](https://github.com/gokayfem/dualview) · [dualview.ai](https://dualview.ai)                                         |
| 原作者           | [Gökay Aydoğan](https://github.com/gokayfem) · [@gokayfem](https://x.com/gokayfem) · [Hugging Face](https://huggingface.co/gokaygokay) |
| 保守中のフォーク | [公開アプリ](https://dualview.yukiworks432.workers.dev) · [YukiWorks432/dualview](https://github.com/YukiWorks432/dualview)            |
| フォークの保守者 | [花雪 / HanaYuki](https://github.com/YukiWorks432) · [@YuK1_Works](https://x.com/YuK1_Works) · [hanayuki.xyz](https://hanayuki.xyz)    |

## どのような確認に使うか

クライアントからの修正、レンダーの変更、圧縮ノイズ、意図しない差分を納品前に確認する。
A/B素材を読み込み、比較表示を選び、差を調べて、確認結果を保存する。

| 入力               | 確認できること                                                                 |
| ------------------ | ------------------------------------------------------------------------------ |
| 動画               | 同期再生、ProRes再生、スコープ、SSIM・PSNR、ヒートマップ、WebGL解析            |
| 画像               | Slider、Side by Side、画素・色の差、ルーペ、ヒストグラム、WebGL解析            |
| 動画に含まれる音声 | 再生位置を示す波形、ラウドネスの参考値、Sample Peak、RMS、位相相関、ステレオ幅 |

単独の音声ファイル、テキスト・JSON、3Dモデル、文書ファイルの比較は対象に含まれない。

---

<h2 id="features">主な機能</h2>

<table>
<tr>
<td width="50%">

### 動画・画像

- フレーム単位の移動と同期再生
- ブラウザー内でのApple ProRes再生
- I/O点を指定したループ
- 複数クリップのタイムライン編集
- クリップのトリムと配置調整

</td>
<td width="50%">

### 解析

- SSIM・PSNRによる品質指標
- Delta Eによる知覚的な色差
- アルファ値を含む差分ヒートマップ
- 画素検査と拡大ルーペ
- 動画スコープ
- A/Bフレーム差分レーンと差分区間への移動

</td>
</tr>
<tr>
<td width="50%">

### 比較表示

- 12種類の画像・動画比較モード
- 8分類・58種類のWebGL解析
- SliderとSide by Side
- 合成、点滅、ヒートマップ、市松模様
- Focus PeakingとZebra
- 同期した拡大・移動

</td>
<td width="50%">

### 書き出し

- 比較画面のPNG/JPEG画像
- PDF比較レポート
- ブラウザー標準対応動画からのMP4・WebM・GIF
- WebGLトランジションと連結書き出し
- 最大4Kのスクリーンショット
- ProResの現在のフレームを画像・PDFへ出力

</td>
</tr>
<tr>
<td width="50%">

### 動画の音声QA

- トリム・配置・速度に従う音声再生
- 再生位置付きの波形表示
- 統合ラウドネスの参考値比較
- Sample PeakとRMS
- 位相相関とステレオ幅
- EBU R128・ATSC A/85の参照目標

</td>
<td width="50%">

### プロジェクト管理

- IndexedDBへの自動保存
- 複数プロジェクトの作成・複製・削除
- 素材を含む`.dualview`の入出力
- 組み込み・独自テンプレート
- Undo/Redoの編集履歴
- タイトル・説明・タグ

</td>
</tr>
</table>

---

<h2 id="comparison-modes">比較表示を選ぶ</h2>

| 画面の名前    | キー | 用途                                              |
| ------------- | ---- | ------------------------------------------------- |
| Slider        | `1`  | 境界を動かしてA/Bを切り替える                     |
| Side by Side  | `2`  | A/Bを並べて同期表示する                           |
| Difference    | `3`  | WebGLによる差分・色・構造の解析を使う             |
| Audio QA      | `4`  | 現在のA/B動画に含まれる音声を確認する             |
| Split Screen  | —    | 複数パネルで表示する                              |
| Quad View     | —    | 4分割で比較する                                   |
| Blend Modes   | —    | Difference、Overlay、Multiply、Screenなどで重ねる |
| Flicker       | —    | A/Bを短い間隔で切り替える                         |
| Heatmap       | —    | 画素とアルファ値の差を色で示す                    |
| Radial Loupe  | —    | 円形のルーペで拡大比較する                        |
| Grid Tile     | —    | 市松模様にA/Bを配置する                           |
| Morphological | —    | 形態学的な処理で差分を調べる                      |

色や細部を調べる場合は、画素検査、ルーペ、SSIM・PSNR、Delta Eも利用できる。
スコープは`G`で表示を切り替える。HistogramはRGB・輝度の分布、Color Wheelは色度、Gamut Warningは色域外の画素を示す。
WebGLの表示ごとの用途は[解析リファレンス](docs/analysis-reference.md)を参照。

---

<h2 id="webgl-analysis">WebGL解析</h2>

GPUで実行するGLSLシェーダーの解析は、8分類・58種類から選べる。
[型定義](src/types/index.ts)と[解析シェーダー](src/lib/webgl/comparison-shaders)が分類と識別子の参照元である。

<details>
<summary><strong>差分 / Difference</strong>（10種類）</summary>

| 表示                            | 用途                                     |
| ------------------------------- | ---------------------------------------- |
| Absolute                        | RGB各成分の差を増幅して表示する          |
| Perceptual                      | LAB色空間のDelta Eで知覚的な色差を調べる |
| Luminance                       | 明るさだけを比較する                     |
| Chroma                          | 明るさを除いた色成分を比較する           |
| Threshold                       | 指定したしきい値で二値マスクを作る       |
| Amplified                       | 小さな差を10〜100倍に強調する            |
| Wipe Vertical / Wipe Horizontal | 縦・横の境界でA/Bを切り替える（2種類）   |
| Split                           | A/Bを50/50で並べる                       |
| Debug                           | テクスチャをそのまま表示して調査する     |

</details>

<details>
<summary><strong>構造 / Structural</strong>（5種類）</summary>

| 表示             | 用途                                   |
| ---------------- | -------------------------------------- |
| SSIM Map         | 局所的な構造の類似度を表示する         |
| Edge Comparison  | Sobelエッジの違いを調べる              |
| Gradient         | 勾配の大きさを比較する                 |
| Local Contrast   | 領域ごとのコントラスト差を調べる       |
| Block Difference | ブロック単位の差から圧縮ノイズを調べる |

</details>

<details>
<summary><strong>色 / Color</strong>（5種類）</summary>

| 表示              | 用途                           |
| ----------------- | ------------------------------ |
| Hue Difference    | 色相環上の位置を比較する       |
| Saturation Map    | 彩度の違いを調べる             |
| False Color       | 差の大きさを虹色の疑似色で示す |
| Channel Split     | R/G/Bを分けて調べる            |
| Histogram Overlay | 分布を重ねて比較する           |

</details>

<details>
<summary><strong>合成・比較補助 / Professional</strong>（6種類）</summary>

| 表示            | 用途                           |
| --------------- | ------------------------------ |
| Anaglyph 3D     | 赤・シアンの立体視用表示       |
| Checkerboard    | 交互の画素タイルで表示する     |
| Onion Skin      | 半透明に重ねる                 |
| Loupe Wipe      | 拡大しながら境界を動かす       |
| Frequency Split | 低周波・高周波成分を分離する   |
| Difference Mask | 差分をアルファマスクとして使う |

</details>

<details>
<summary><strong>時間変化 / Video</strong>（4種類）</summary>

| 表示              | 用途                               |
| ----------------- | ---------------------------------- |
| Temporal Diff     | フレーム間の変化を調べる           |
| Motion Vectors    | オプティカルフローの近似を表示する |
| Flicker Detection | 不安定な画素を検出する             |
| Frame Blend       | 時間方向にフレームを混ぜる         |

</details>

<details>
<summary><strong>知覚的重み付け / Perceptual Weighting</strong>（3種類）</summary>

| 表示          | 用途                                   |
| ------------- | -------------------------------------- |
| Saliency      | 視覚的な注目度を重みに使う             |
| Edge Weighted | エッジを考慮して比較する               |
| Weighted SSIM | 知覚的に重み付けした構造類似度を調べる |

</details>

<details>
<summary><strong>高度な解析 / Advanced Analysis</strong>（17種類）</summary>

| 表示                             | 用途                                             |
| -------------------------------- | ------------------------------------------------ |
| Multi-scale Edge                 | ラプラシアンピラミッドによる複数尺度のエッジ比較 |
| Local Contrast                   | 局所標準偏差の表示                               |
| Gradient Direction               | 勾配の方向を色相へ対応させる                     |
| Direction Histogram              | 勾配方向の分布                                   |
| Optical Flow                     | 8×8・16×16・32×32のブロック単位の動きの近似      |
| FFT Magnitude                    | ラプラシアンに基づく周波数成分の近似表示         |
| FFT Phase                        | 勾配方向に基づく表示                             |
| Low-pass / High-pass / Band-pass | 低域・高域・帯域を分離する                       |
| Temporal Noise / Noise Variance  | 時間方向の変化と空間的なばらつき                 |
| Diff Accumulator                 | 最大値・平均値・減衰する動き履歴の蓄積           |

</details>

<details>
<summary><strong>露出 / Exposure</strong>（8種類）</summary>

| 表示                | 用途                               |
| ------------------- | ---------------------------------- |
| False Color         | 露出レベルを疑似色で示す           |
| Focus Peaking (`P`) | 鋭いエッジを強調する               |
| Zebra Stripes (`Z`) | 100 IREの過露出の目安を示す        |
| Zone System         | Ansel Adamsの露出区分0〜Xを示す    |
| 各表示のA/B比較版   | 上記4種類それぞれにA/B比較版がある |

</details>

FFT表示は厳密な離散フーリエ変換の測定値ではない。時間方向の表示は取り込まれたフレーム履歴の影響を受ける。
解析値や疑似色は確認の参考情報であり、品質や放送・配信規格への適合を認証しない。
元のA/B画像も併せて判断する。詳しい読み方は[解析リファレンス](docs/analysis-reference.md)を参照。

---

## 素材の取り込み・再生・クリップ編集

ファイル選択、ドロップ、画像の貼り付け、URLから素材を取り込める。
ローカルファイルはブラウザー内に独立したコピーを作ってから処理する。
URL取り込みでは入力した取得先に接続するが、既に読み込んでいる別のローカル素材をそこへ送信することはない。

取り込み中や再試行中に素材を削除したり、素材一覧を全消去したり、別のプロジェクトを作成・読み込みした場合は、
無効になった処理結果を後から追加しない。不要なオブジェクトURLとデコード用リソースも解放する。
URL取り込み画面を閉じると、その取り込み要求を中断する。

## 動画を再生して位置をそろえる

再生操作は共通の再生位置を使う。`J`または`L`を繰り返すと、その方向の速度が1倍、2倍、4倍、8倍へ切り替わる。
`Space`は方向を保って停止・再開し、`K`は停止して順方向1倍へ戻す。速度を選択した場合も順方向になる。
逆再生の音声は合成しないため、逆方向の再生は無音になる。

停止中は`←`・`→`でフレーム送り、再生中は1秒ずつ移動する。`Shift`を併用すると5秒ずつ移動する。
`Home`は先頭へ、`End`はタイムラインの最後のフレームへ移動して停止する。
`I`・`O`でループ範囲を設定すると、順方向・逆方向のどちらでも範囲内を繰り返す。
停止中のシークやマーカーへの移動でも、通常動画とProResの表示を更新する。

## クリップを編集する

クリップの開始位置とトリムを調整し、比較する時刻をそろえる。分割、複製、コピー・貼り付けも利用できる。
一定の再生速度と逆再生の設定は、分割・トリム・複製・貼り付け後も保持する。
リップル編集では、長さの変更に応じて同じトラックの後続クリップを移動する。

素材を差し替えると、クリップの開始位置と素材のトリム開始位置を保ち、新しい素材の末尾までを使う。
新しい素材がトリム開始位置より短い場合は、理由を表示して元の編集を保持する。

### キーフレーム付きクリップ

保存ファイル内のキーフレームを読み込める。複製・貼り付けでは相対時刻と補間設定もコピーする。
末尾のトリムや左側だけを残す操作では、範囲外のキーフレームも削除しない。Undo/Redoではクリップと一緒に復元する。

キーフレーム付きクリップの分割、先頭のトリム、右側だけを残す操作は、時刻変換の仕様が未定義のため利用できない。
これらの操作を試すと理由を表示し、データを保持する。

### フィルムストリップ

タイムラインのフィルムストリップは1秒間隔、最大60枚で抽出する。
同じ素材と設定の抽出結果は再利用し、クリップの移動・トリム・表示切り替えがあっても抽出を続ける。
失敗時は通常のサムネイル表示へ戻る。素材の削除・置換では、処理中の抽出と保存済み結果を破棄する。

抽出にはブラウザー標準の動画デコードを使うため、ProResのフィルムストリップはブラウザーの対応範囲に限られる。
ProResの比較プレビューで使うデコーダーとは別の経路である。

---

## A/Bフレーム差分を探す

### タイムライン全体の差分

1. A/B動画を配置し、タイムラインの`Analyze`を実行する。
2. 差分レーンに表示された区間を確認する。クリックで移動するか、前後の移動ボタンで強調された区間を順に見る。
3. 必要に応じて画素のしきい値、面積のしきい値、解像度を調整する。

解析は、動画に記録されたフレーム時刻をクリップのトリム、速度、逆再生へ対応付ける。
専用WorkerがMediabunnyでデコード・比較するため、共通のプレビューをシーク・停止させない。
ProResも解析できるが、画像クリップはこの動画フレーム解析の対象外。

| 設定                       | 意味                                                           |
| -------------------------- | -------------------------------------------------------------- |
| 標準解像度                 | 長辺を最大640画素に縮小して比較する                            |
| Full                       | 素材の表示寸法で比較する。メモリー使用量が大きくなる場合がある |
| 画素のしきい値（既定0.10） | 1画素を差分と判定するために必要な違い                          |
| 面積のしきい値（既定2%）   | 区間を強調するために必要な差分画素の割合                       |

透明画素は見える色と不透明度で比較する。両側とも完全に透明な画素の内部RGB値だけが違っても、差分にはしない。
欠落フレーム、A/Bの空白、非対応素材、デコード失敗は「差分なし」と区別して表示する。
解析済みの区間と未解析の区間も区別する。

結果は現在のブラウザーセッション内だけで保持する。プロジェクト、タイムライン、素材、画素のしきい値、解像度を変えると破棄する。
面積のしきい値だけを変えた場合は、保存中の評価値から強調表示を更新し、再デコードしない。

### 現在のフレームの差分領域

`Slider`と`Side by Side`は、停止中のA/B差分を矩形で囲む。既定で有効で、設定から無効にできる。
シークやフレーム送りでは前の解析結果を無効にし、両側の新しいフレームが準備できてから解析する。
再生すると矩形を隠し、この解析を止める。

タイムライン解析と同じ画素差分の判定を使い、つながった差分画素を矩形にまとめる。
感度、小領域の除外、共通解像度の自動選択・全解像度は、この表示用に個別調整できる。
矩形は操作中の確認用であり、画像・動画の書き出しには含まれない。

---

## 動画の音声を確認する

`Audio QA`は、Track A/Bの動画に含まれる主音声トラックを解析する。
音声再生はクリップの配置、トリム開始位置、再生速度に従う。単独の音声ファイルは取り込めない。

| 指標                   | 読み方                                                         |
| ---------------------- | -------------------------------------------------------------- |
| Integrated loudness    | デコードした素材全体のラウドネス推定値                         |
| Tail 400 ms / Tail 3 s | 素材の末尾400ミリ秒／3秒の値。現在の再生位置のメーターではない |
| Sample Peak            | デコードしたサンプルの最大値。規格準拠のdBTPとしては扱わない   |
| RMS                    | 二乗平均平方根によるレベル                                     |
| Phase correlation      | ステレオの位相関係                                             |
| Stereo width           | Mid/Sideから求めた幅の指標                                     |

参照目標にはSpotify、YouTube、Apple Music、EBU R128（-23 LUFS）、ATSC A/85（-24 LUFS）がある。
±1 LUの表示は比較の目安であり、各サービスや放送規格への適合を認証しない。

デコード後のPCM推定量が512 MiBを超える素材は解析を開始せず、理由を表示する。
長時間・多チャンネル素材によるブラウザーのメモリー枯渇を避けるための制限である。

### 音声のショートカット

| キー    | 操作                  |
| ------- | --------------------- |
| `A`     | Track Aだけを再生する |
| `B`     | Track Bだけを再生する |
| `S`     | A+Bを再生する         |
| `Space` | 再生・停止            |

`B`・`S`はほかの操作にも割り当てられるため、詳しくは[ショートカット](#shortcuts)を参照。

---

<h2 id="export">比較結果を書き出す</h2>

`E`で書き出し画面を開く。確認したい結果に応じて形式と出力元を選ぶ。

| 出力                 | 選択肢・条件                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| 画像                 | PNG/JPEG、720p・1080p・4K、比較画面・Aのみ・Bのみ。JPEGの画質調整とクリップボードへのコピーに対応 |
| PDF                  | 比較レポート。ProResの現在のデコード済みフレームも利用できる                                      |
| 動画・GIF            | MP4/WebM/GIF、720p・1080p・4K、24・30・60 fps、Low・Medium・High、比較・Aのみ・Bのみ              |
| トランジション・連結 | WebGLの切り替え効果や複数の表示を使って書き出す                                                   |

動画・GIF・トランジション・連結には、ブラウザー標準でデコードできる動画が必要。
ProRes素材はこれらの書き出しでは拒否し、古いフレームや不正なフレームを出力しない。
MP4は`VideoEncoder`対応が必要だが、MP4・GIFの書き出しにWebM対応は不要。GIFは同梱のローカルWorkerで処理する。

アニメーション書き出しは`Cancel`で中止できる。中止・失敗時にはリソースを解放してから次の書き出しを受け付ける。
借用したプレビュー動画は停止中の位置へ戻す。
切り替え効果とスイープの一覧は[解析・書き出しリファレンス](docs/analysis-reference.md#transitions)を参照。

### WebGLトランジション

100種類を超えるGPUトランジションで比較動画の切り替えを表現できる。
全バリエーションと実際の識別子は[シェーダー一覧](src/lib/webgl/shaders/index.ts)を参照。

| 分類                          | バリエーション数 | 表示名の例                                                                                                                  |
| ----------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Crossfade**                 | 1                | A/Bを混ぜて切り替える                                                                                                       |
| **Dissolve**                  | 8                | Powder, Ink, Cellular, Bokeh, Fractal, Smoke, Sand, Sparkle                                                                 |
| **Wipe**                      | 12               | Left, Right, Up, Down, Radial, Radial CCW, Spiral, Clock, Clock CCW, Iris, Blinds H, Blinds V                               |
| **Zoom**                      | 8                | Zoom In, Zoom Out, Zoom Push, Zoom Pull, Zoom Blur, Zoom Rotate, Zoom Bounce, Zoom Spiral                                   |
| **Blur**                      | 8                | Gaussian, Motion, Radial, Dreamy, Bokeh, Directional, Spin, Focus                                                           |
| **Rotate**                    | 8                | Clockwise, Counter-CW, Flip H/V, Spin 3D, Swirl, Cube, Fold                                                                 |
| **Light**                     | 8                | Soft Leak, Hard Leak, Glow Veil, Lens Flare, Flash, Light Rays, Burn, Fade White                                            |
| **Prism**                     | 8                | RGB Split, Spectral Smear, Chroma Pulse, Rainbow, Prism Wipe, Aberration, Color Shift, Dispersion                           |
| **Glitch**                    | 8                | Scan Jitter, Line Tear, Block Drift, Digital, Corrupt, Static, VHS, Data Mosh                                               |
| **Morph**                     | 8                | Smooth, Warp, Liquify, Twist, Bulge, Wave, Ripple, Melt                                                                     |
| **Pixelate**                  | 8                | Block, Dither, Mosaic, Retro, 8-Bit, Halftone, Dots, Crosshatch                                                             |
| **Refraction**                | 8                | Micro Lens, Glass Ripple, Heat Haze, Water, Crystal, Diamond, Frosted, Bubble                                               |
| **Shutter**                   | 8                | Dir. Smear, Frame Echo, Time Ghost, Trail, Streak, Motion Lines, Afterimage, Persistence                                    |
| **Stylized（内部名`other`）** | 12               | Kaleidoscope, Liquid Metal, Neon Dreams, Aurora, Matrix, Film Burn, TV Static, Comic, Sketch, Negative, Solarize, Crossfade |

Crossfadeは独立した分類とStylizedの両方から選べる。

### スイープアニメーション

| 表示名           | 動き                                          |
| ---------------- | --------------------------------------------- |
| Horizontal       | 左から右へ境界を動かす                        |
| Vertical         | 上から下へ境界を動かす                        |
| Diagonal         | 角から対角へ境界を動かす                      |
| Circle           | 円を広げる                                    |
| Rectangle        | 矩形を広げる                                  |
| Spotlight        | DVDのスクリーンセーバーのように矩形を跳ね返す |
| Spotlight Circle | 円を跳ね返す                                  |

---

<h2 id="shortcuts">キーボード操作</h2>

| 操作                                      | キー                                     |
| ----------------------------------------- | ---------------------------------------- |
| 再生・停止                                | `Space`                                  |
| フレーム送り（停止中）／1秒移動（再生中） | `←`・`→`                                 |
| 5秒移動                                   | `Shift` + `←`・`→`                       |
| 逆方向再生／停止／順方向再生              | `J`・`K`・`L`                            |
| 先頭／末尾へ移動                          | `Home`・`End`                            |
| ループ開始／終了                          | `I`・`O`                                 |
| ループ解除                                | `Escape`                                 |
| マーカー追加                              | `M`                                      |
| 主な比較表示へ切り替え                    | `1`〜`4`                                 |
| DifferenceでA/Bを入れ替え                 | `F`                                      |
| Focus Peaking／Zebra／スコープの表示      | `P`・`Z`・`G`                            |
| 選択クリップの分割                        | `S`                                      |
| 再生位置の左側／右側を残す                | `Q`・`W`                                 |
| リップル編集／スナップの切り替え          | `R`・`N`                                 |
| 選択クリップの削除                        | `Delete`                                 |
| タイムライン／サイドバーの表示            | `T`・`B`                                 |
| 書き出し画面                              | `E`                                      |
| スクリーンショット／品質指標の表示        | `Shift` + `S`・`Shift` + `M`             |
| Undo／Redo                                | `Ctrl/⌘` + `Z`・`Ctrl/⌘` + `Shift` + `Z` |
| プロジェクトの保存                        | `Ctrl/⌘` + `S`                           |
| ヘルプ                                    | `?`                                      |

`Audio QA`では`A`がTrack A、`B`がTrack B、`S`がA+Bの選択になる。
`B`と`S`はサイドバー切り替え・クリップ分割にも割り当てられているため、音声画面では画面上のボタンを使うと操作対象を選びやすい。
ダイアログや入力欄、ドラッグ中にはキーの扱いが変わる。`Escape`は表示中のダイアログやドラッグの取り消しにも使う。

---

## 動画スコープ

放送用モニターに近い表示で、色や明るさを確認できる。`G`で表示を切り替える。

| スコープ      | 用途                           |
| ------------- | ------------------------------ |
| Histogram     | RGB・輝度の分布                |
| Color Wheel   | ベクトルスコープ形式の色度表示 |
| Gamut Warning | 色域外の画素の強調             |

---

## プロジェクト管理

プロジェクトと素材はIndexedDBへ自動保存する。保存の対象となる編集から500ミリ秒待って保存をまとめる。
比較、スコープ、書き出し、タイムラインの保存対象設定、タイトル・説明・タグ、素材の差し替え、キーフレーム編集も含まれる。

新しい編集が未保存なら未保存表示を保ち、最新の書き込み中は保存中表示になる。書き込み失敗も表示する。
再生位置は次の保存に含めるが、再生位置の毎回の更新、解析進捗、ポインター情報、選択変更だけでは保存を予約しない。

プロジェクトの作成・読み込みでは、先に現在の編集を保存する。
移動先の読み込みとデコードが完了するまでは現在の作業を維持する。
保存・読み込みに失敗しても現在の編集と素材を保持し、Projects画面に理由を表示して再試行できる。
切り替え要求が重なった場合は、最後の要求だけを有効にする。

プロジェクトを開く・作成する・使用中のプロジェクトを削除する際には、Undo/Redo、選択、クリップとキーフレームのコピー内容、再生状態をリセットする。
同じプロジェクトを編集中のUndo/Redoは引き続き利用できる。
プロジェクトは複製・削除でき、組み込み・独自テンプレートも利用できる。

`.dualview`は素材を含むJSON形式のプロジェクトファイル。共有先には素材自体も渡るため、元ファイルと同じ注意で扱う。
ブラウザーのサイトデータを削除すると保存済みの作業も失われる。重要なデータは先に書き出して保管する。

保存ファイルの形式は従来の`.dualview`と互換である。
ローカル素材は運営者へアップロードされず、このブラウザーに保存される。

---

## 技術構成

<table>
<tr>
<td>

| UI・状態管理 | 版     |
| ------------ | ------ |
| React        | 19.3.0 |
| TypeScript   | 7.0.2  |
| Vite         | 8.3.0  |
| Zustand      | 5.0.15 |
| Tailwind CSS | 4.3.3  |

</td>
<td>

| 処理               | 技術                      |
| ------------------ | ------------------------- |
| 通常動画のデコード | ブラウザーのメディア処理  |
| ProResデコード     | Mediabunny + TurboRes     |
| 動画エンコード     | WebCodecs / MediaRecorder |
| MP4多重化          | Mediabunny                |
| GIFエンコード      | gif.js                    |
| PDF書き出し        | jsPDF                     |

</td>
</tr>
</table>

版番号は[package.json](package.json)と[pnpm-lock.yaml](pnpm-lock.yaml)に対応する。
解析画面や書き出し処理の大きなモジュールは、必要になった時点で読み込む。

| 開発ツール | 役割                                                   |
| ---------- | ------------------------------------------------------ |
| pnpm 12    | 依存関係とロックファイルの管理                         |
| Oxfmt      | 書式とimport順の整理                                   |
| Oxlint     | 型情報を使ったlint                                     |
| Vitest 5   | 単体テスト                                             |
| Playwright | Chromiumのブラウザーテスト                             |
| GitHub CI  | 固定ロックファイルでの導入、品質検査、ブラウザーテスト |

### Fluid Functionalismの面表現

相対的な面の高さを扱う仕組みは、Fluid Functionalismの`@fluid/elevated`レジストリ項目を基にしている。
[components.json](components.json)に`@fluid`を登録し、次のファイルに上流由来の実装を置く。

- `src/lib/surface-context.ts`
- `src/lib/surface-provider.tsx`
- `src/lib/surface-classes.ts`
- `src/lib/elevated.tsx`

DualView固有の`asChild`互換処理と操作面の変数は、`src/components/ui/surface.ts`に分ける。
更新前には差分と試行結果を確認する。

```bash
pnpm dlx shadcn@latest add @fluid/elevated --diff
pnpm dlx shadcn@latest add @fluid/elevated --dry-run
```

採用する更新を適用した後は、独自処理を互換層に保ち、`pnpm check`を実行する。
第三者コードのライセンスと通知も維持する。

---

<h2 id="getting-started">ローカルで動かす</h2>

Node.jsは[.node-version](.node-version)、pnpmは[package.json](package.json)の`packageManager`に合わせる。
現在の指定はNode.js 24.21.0、pnpm 12.5.1。`engines`の最低条件はNode.js 24.21.0、pnpm 12.0.0。
`fnm`を使う場合は[公式手順](https://github.com/Schniz/fnm#installation)で導入しておく。

```bash
git clone https://github.com/YukiWorks432/dualview.git
cd dualview
fnm install
fnm use
pnpm install --frozen-lockfile
pnpm dev
```

以降のコマンドもリポジトリのルートで実行する。
`pnpm dev`が出力したURLを開くと、開発中のアプリを確認できる。
依存関係を更新する場合は`package.json`と`pnpm-lock.yaml`を対応させる。

## 変更を検証する

```bash
pnpm check
```

`check`は書式、lint、型検査、単体テスト、製品版ビルドを順に実行する。
途中で失敗した場合は、その段階を修正してから再実行する。

| コマンド            | 確認する内容                            |
| ------------------- | --------------------------------------- |
| `pnpm format:check` | Oxfmtの書式                             |
| `pnpm format`       | 書式を修正する。実行後に差分を確認する  |
| `pnpm lint`         | Oxlintの型情報を使った検査              |
| `pnpm typecheck`    | TypeScriptのプロジェクト検査            |
| `pnpm test:run`     | Vitestの単体テスト                      |
| `pnpm test`         | Vitestの監視実行                        |
| `pnpm build`        | TypeScript検査とViteビルド              |
| `pnpm preview`      | ビルド済みの`dist/`をローカルで確認する |

ブラウザーテストは`check`とは別に実行する。初回はPlaywright用のChromiumを用意する。

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

CIは固定ロックファイルで依存関係を導入し、通常検査とChromiumのブラウザーテストを別ジョブで実行する。
正確な処理順は[CI設定](.github/workflows/ci.yml)、テスト環境は[Playwright設定](playwright.config.ts)を参照。
素材の由来、生成コマンド、過去の測定値は[試験素材ガイド](e2e/fixtures/README.md)にまとめている。
過去の測定値を今回の検証結果として扱わない。

---

## Cloudflareへ公開する

このフォークはCloudflare Workers Static Assetsで公開する。
アプリ用WorkerやバックエンドAPIは置かず、WranglerでViteの`dist/`をアップロードする。
公開先アカウントの権限を確認してから、次を実行する。`pnpm deploy`は公開内容を変更する。

```bash
pnpm build
pnpm deploy
```

Wranglerは開発依存関係に含まれ、ロックファイルの版を使用する。
[wrangler.jsonc](wrangler.jsonc)は`workers.dev`ルートを有効にし、独自ドメインはCloudflare側で設定する。
存在しないパスは`public/404.html`を返す。アプリの画面へ一律に転送する設定ではない。

ビルドには`ffmpeg.wasm`を含めない。書き出しはブラウザー標準APIとgif.jsを使うため、
旧`ffmpeg-core.wasm`のサイズ制限を公開条件に含める必要はない。
Viteは依存コードの通知を`dist/licenses/third-party.md`へ生成する。
同梱・別経路で読み込むコードの通知は[additional-notices.md](public/licenses/additional-notices.md)で管理する。

独自ドメインの設定はCloudflare側で戻せるため、解除する際にリポジトリを変更する必要はない。

---

## ディレクトリ構成

```
src/
├── components/
│   ├── comparison/        # 画像・動画の比較と解析
│   │   ├── SliderComparison.tsx
│   │   ├── SideBySide.tsx
│   │   ├── WebGLComparison.tsx
│   │   ├── AudioComparison.tsx
│   │   ├── BlendModes.tsx
│   │   └── DifferenceHeatmap.tsx
│   ├── export/            # 書き出し設定
│   ├── layout/            # ヘッダー、サイドバー、書き出し画面
│   ├── media/             # 通常動画・ProResの表示と素材取込
│   ├── preview/           # 比較画面のキャプチャ
│   ├── timeline/          # タイムラインとクリップ編集
│   ├── scopes/            # 動画スコープ
│   └── ui/                # 共通UI部品
├── stores/                # Zustandの状態管理
├── hooks/                 # 再生・ProRes・UIの連携
├── lib/
│   ├── audio/             # ラウドネス・波形・ステレオ解析
│   ├── media/             # 素材調査・ProRes/音声デコード・時刻変換
│   ├── webgl/             # 比較・トランジションのシェーダー
│   ├── mp4Encoder.ts
│   ├── gifEncoder.ts
│   └── metrics.ts         # SSIM・PSNRの計算
└── types/
```

差分解析は`src/lib/difference/`、静的ページ・同梱Worker・ライセンス通知は`public/`に置く。

---

## 利用例

<table>
<tr>
<td width="50%">

### 制作物の納品前確認

- クライアント修正の反映確認
- レタッチ前後の比較
- カラーグレーディングの比較
- VFXレンダーとアニメーションのQA

</td>
<td width="50%">

### 品質確認

- 意図しない変更の検出
- 圧縮ノイズの確認
- フレーム単位の検証
- レビュー用の画像・PDFの保存

</td>
</tr>
<tr>
<td width="50%">

### 動画の仕上げ

- ProRes素材の再生
- 動画音声のラウドネス参考値確認
- 動画スコープ
- A/Bの同期確認

</td>
<td width="50%">

### 生成素材のレビュー

- 画像生成のA/B比較
- アップスケーリングの品質確認
- 動画出力の比較
- 見た目の回帰検査

</td>
</tr>
</table>

---

## ブラウザーと動作条件

| ブラウザー | 従来からの対応目標 |
| ---------- | ------------------ |
| Chrome     | 111以降            |
| Edge       | 111以降            |
| Firefox    | 114以降            |
| Safari     | 16.4以降           |

これらは対応の基準であり、全機能が各版で検証済みという意味ではない。
ProResの再生はMediabunny/TurboResでローカルにデコードする。
ProResのアニメーション書き出しは利用できないが、現在のフレームの画像・PDF出力は利用できる。

- WebGL解析にはWebGL 2.0が必要。
- MP4書き出しにはWebCodecsの`VideoEncoder`が必要。
- タイムライン差分解析にはWorkerとOffscreenCanvasが必要。
- 現在のフレームの差分矩形にはフレーム通知APIが必要。このAPIがない環境でも、比較プレビュー自体は読み込み・シークの完了で更新する。
- ProRes再生・タイムライン解析はMediabunnyのProResデコーダーを使う。フィルムストリップとアニメーション書き出しの対応とは区別する。

Heatmapは単発描画と再生中の連続描画を分け、入力Canvasと出力の画素配列を再利用する。
停止中は、フレーム、設定、表示サイズの変更時だけ更新する。
WebGL Split Viewの中央解析は左右と同じ素材・再生位置・トリム・速度・逆再生を使う。
連続したシークは進行中の処理後に最後の要求を反映し、空白区間やフレーム待ちの間は古い解析結果を残さない。
停止中に連続描画するのは、点滅検出と2種類のゼブラのアニメーション。
比較画面を離れると予約済みの描画を取り消し、作業用バッファを解放する。

---

<details>
<summary><strong>このプロジェクトを引用する</strong></summary>

このリポジトリは[gokayfem/dualview](https://github.com/gokayfem/dualview)の保守フォークである。
引用情報は原作者Gökay Aydoğanへの帰属を保ち、花雪 / HanaYukiをこのフォークの保守者として示す。
このフォークを利用した成果の引用には、GitHubの`Cite this repository`または[CITATION.cff](CITATION.cff)を使う。
対応するBibTeXは次のとおり。

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

[原プロジェクト](https://github.com/gokayfem/dualview) ·
[原作者のORCID](https://orcid.org/0000-0002-2343-9433) ·
[このフォークの引用情報](CITATION.cff)

</details>

## クレジット

DualViewの原作者はGökay Aydoğan、原プロジェクトはgokayfem/dualviewである。
このフォークは花雪 / HanaYukiが保守する。

| 役割             | GitHub                                             | X                                       | Webサイト                            |
| ---------------- | -------------------------------------------------- | --------------------------------------- | ------------------------------------ |
| 原作者           | [gokayfem](https://github.com/gokayfem)            | [@gokayfem](https://x.com/gokayfem)     | [dualview.ai](https://dualview.ai)   |
| フォークの保守者 | [花雪 / HanaYuki](https://github.com/YukiWorks432) | [@YuK1_Works](https://x.com/YuK1_Works) | [hanayuki.xyz](https://hanayuki.xyz) |

---

## ライセンスと問い合わせ

ソースコードは[MIT License](LICENSE)で公開する。第三者コードの通知と対応するソースコードは
[ライセンスページ](https://dualview.yukiworks432.workers.dev/licenses/)に掲載する。

不具合・改善提案は[Issues](https://github.com/YukiWorks432/dualview/issues)、変更提案は
[Pull requests](https://github.com/YukiWorks432/dualview/pulls)で受け付ける。
個人情報や非公開の素材を含む問い合わせは[保守者の窓口](https://hanayuki.xyz/contact/)を利用する。

[プライバシー](https://dualview.yukiworks432.workers.dev/privacy/) ·
[利用条件](https://dualview.yukiworks432.workers.dev/terms/) ·
[サイトについて](https://dualview.yukiworks432.workers.dev/about/)

<p align="center">
  <sub>一つひとつの画素を大切にするクリエイターへ</sub>
</p>
