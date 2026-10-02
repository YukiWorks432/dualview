<p align="center">
  <img src="public/favicon.svg" width="64" height="64" alt="DualViewのロゴ">
</p>

# DualView

画像と動画を並べて、納品前の変更や意図しない差分を確認するブラウザーアプリ。
A/Bの同期再生、画素・色・構造の解析、動画に含まれる音声の確認、比較結果の書き出しに対応する。

[アプリを開く](https://dualview.yukiworks432.workers.dev) ·
[English](README.en.md) · [利用ガイド](docs/user-guide.md) ·
[開発・公開手順](docs/development.md)

![A/Bの素材を比較するDualViewのデモ](https://github.com/user-attachments/assets/24a2b466-a9d9-4b0a-990a-66b47b308357)

## 比較を始める

1. アプリを開き、比較する画像または動画を読み込む。
2. 素材をTrack AとTrack Bに配置し、必要に応じて開始位置やトリムをそろえる。
3. `Slider`で境界を動かすか、`Side by Side`で両方を表示する。動画は同期再生し、停止してフレームごとの差を確認する。
4. 詳細を調べる場合は`Difference`、動画の音声を調べる場合は`Audio QA`を選ぶ。
5. 比較結果を画像やPDFに書き出す。編集を引き継ぐ場合は、素材を含む`.dualview`ファイルを保存する。

ローカル素材はブラウザー内で処理され、運営者へアップロードされない。
URLからの取り込みでは取得先へ直接通信する。プロジェクトはこのブラウザーに自動保存されるため、
重要な作業は別途書き出して保管する。詳しくは[データの取り扱い](https://dualview.yukiworks432.workers.dev/privacy/)を参照。

<h2 id="features">できること</h2>

| 確認したいこと                     | 主な機能                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ |
| 修正前後、レンダー、圧縮結果の違い | 12種類の比較表示、同期した拡大・移動、フレーム送り、ループ、マーカー     |
| 色や細部の変化                     | WebGL解析、SSIM・PSNR、Delta E、ヒートマップ、画素検査、ルーペ、スコープ |
| 動画の途中にある差分               | A/Bフレーム差分レーン、差分区間への移動                                  |
| 動画の音声                         | 波形、ラウドネスの参考値、Sample Peak、RMS、位相相関、ステレオ幅         |
| 確認結果の共有                     | PNG/JPEG、PDF、通常動画からのMP4/WebM/GIF、トランジション、連結書き出し  |
| 比較作業の再開                     | 複数プロジェクト、自動保存、`.dualview`入出力、テンプレート、Undo/Redo   |

画像生成やアップスケーリングの比較、レタッチ、カラーグレーディング、VFXの確認にも使える。
単独の音声ファイル、テキスト・JSON、3Dモデル、文書ファイルの比較は対象に含まれない。

<h2 id="comparison-modes">比較表示を選ぶ</h2>

`1`〜`4`で`Slider`、`Side by Side`、`Difference`、`Audio QA`を切り替える。
重ね合わせ、点滅、分割表示などを含む全モードと使い分けは[利用ガイド](docs/user-guide.md#comparison-modes)に記載する。

<h2 id="webgl-analysis">解析結果を読む</h2>

`Difference`には、差分、構造、色、合成、時間変化、知覚的重み付け、高度な解析、露出の8分類がある。
各表示の目的と制約は[解析リファレンス](docs/analysis-reference.md)を参照。
解析値は確認の参考情報であり、品質や放送・配信規格への適合を認証するものではない。

<h2 id="export">書き出しの条件</h2>

画像とPDFはProResの現在のデコード済みフレームも扱える。
動画・GIF・トランジション・連結書き出しには、ブラウザー標準でデコードできる動画が必要。
MP4はWebCodecsの`VideoEncoder`対応にも依存する。
解像度や形式、中止時の動作は[書き出しガイド](docs/user-guide.md#export)で確認できる。

<h2 id="shortcuts">キーボード操作</h2>

`Space`で再生・停止、停止中の`←`・`→`でフレーム送り、`J`・`K`・`L`で逆方向・停止・順方向の再生を操作する。
`?`でショートカット一覧を表示できる。画面ごとに意味が変わるキーを含む一覧は
[ショートカット](docs/user-guide.md#shortcuts)を参照。

<h2 id="getting-started">ローカルで動かす</h2>

Node.jsは[.node-version](.node-version)の版（24.21.0）、pnpmは[package.json](package.json)の版（12.5.1）を使う。
`fnm`を利用する場合は[公式の導入手順](https://github.com/Schniz/fnm#installation)で先に用意する。

```bash
git clone https://github.com/YukiWorks432/dualview.git
cd dualview
fnm install
fnm use
pnpm install --frozen-lockfile
pnpm dev
```

端末に表示された開発サーバーのURLをブラウザーで開く。
品質検査は`pnpm check`、製品版のビルドは`pnpm build`で実行する。
テスト、構成、依存コードの更新、Cloudflareへの公開は[開発・公開手順](docs/development.md)にまとめている。

## ブラウザーと制約

基準とするブラウザーはChrome 111以降、Edge 111以降、Firefox 114以降、Safari 16.4以降。
これは従来の対応目標であり、全機能が各版で検証済みという意味ではない。
WebGL 2.0、WebCodecs、Worker、OffscreenCanvasなど、機能ごとに必要なAPIが異なる。
ProResの再生にはMediabunny/TurboResを使う。機能別の条件は[利用ガイド](docs/user-guide.md#requirements)を参照。

<h2 id="project-lineage">原プロジェクトとこのフォーク</h2>

DualViewの原作者は[Gökay Aydoğan](https://github.com/gokayfem)。原プロジェクトは
[gokayfem/dualview](https://github.com/gokayfem/dualview)、原サイトは[dualview.ai](https://dualview.ai)。
このリポジトリと公開サイトは[花雪 / HanaYuki](https://github.com/YukiWorks432)が保守・開発している。

- 原作者: [X](https://x.com/gokayfem) · [Hugging Face](https://huggingface.co/gokaygokay) · [ORCID](https://orcid.org/0000-0002-2343-9433)
- フォークの保守者: [hanayuki.xyz](https://hanayuki.xyz) · [X](https://x.com/YuK1_Works)
- 引用: GitHubの`Cite this repository`と[CITATION.cff](CITATION.cff)を利用できる。[引用例](docs/development.md#citation)も参照。

## ライセンスと問い合わせ

ソースコードは[MIT License](LICENSE)で公開する。第三者コードの通知と対応するソースコードは
[ライセンスページ](https://dualview.yukiworks432.workers.dev/licenses/)に掲載する。

不具合・改善提案は[Issues](https://github.com/YukiWorks432/dualview/issues)、変更提案は
[Pull requests](https://github.com/YukiWorks432/dualview/pulls)で受け付ける。
個人情報や非公開の素材を含む問い合わせは[保守者の窓口](https://hanayuki.xyz/contact/)を利用する。

[プライバシー](https://dualview.yukiworks432.workers.dev/privacy/) ·
[利用条件](https://dualview.yukiworks432.workers.dev/terms/) ·
[サイトについて](https://dualview.yukiworks432.workers.dev/about/)
