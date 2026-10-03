# 開発・公開手順

[README](../README.md) · [English](#english) · [試験素材](../e2e/fixtures/README.md)

## 開発環境を用意する

Node.jsは[.node-version](../.node-version)、pnpmは[package.json](../package.json)の`packageManager`に合わせる。
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
正確な処理順は[CI設定](../.github/workflows/ci.yml)、テスト環境は[Playwright設定](../playwright.config.ts)を参照。
素材の由来、生成コマンド、過去の測定値は[試験素材ガイド](../e2e/fixtures/README.md)にまとめている。
過去の測定値を今回の検証結果として扱わない。

## 実装を探す

| 場所                                                 | 主な責務                                                 |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `src/components/comparison/`                         | 比較表示、音声確認、解析画面                             |
| `src/components/export/`、`src/components/layout/`   | 書き出し設定、画面構成                                   |
| `src/components/media/`、`src/components/preview/`   | 通常動画・ProResの表示、取り込み、比較キャプチャ         |
| `src/components/timeline/`、`src/components/scopes/` | クリップ編集、スコープ                                   |
| `src/components/ui/`                                 | 共通UI部品                                               |
| `src/stores/`、`src/hooks/`                          | Zustandの状態管理、再生・ProRes・UIの連携                |
| `src/lib/audio/`、`src/lib/media/`                   | 音声解析、素材調査、デコード、タイムライン時刻の変換     |
| `src/lib/difference/`                                | 差分解析のWorkerと関連処理                               |
| `src/lib/webgl/`                                     | 比較・スコープ・トランジションの描画                     |
| `src/lib/mp4Encoder.ts`、`src/lib/gifEncoder.ts`     | 動画・GIFのエンコード                                    |
| `src/lib/metrics.ts`                                 | SSIM・PSNRの計算                                         |
| `src/types/`                                         | 共通の型                                                 |
| `public/`                                            | 静的ページ、フォント読み込み、同梱Worker、ライセンス通知 |

UIはReact・TypeScript・Tailwind CSS、状態管理はZustandを使う。
通常動画はブラウザーのメディア処理、ProResはMediabunny/TurboResでデコードする。
動画出力にはWebCodecs・MediaRecorder、MP4の多重化にはMediabunny、GIFにはgif.js、PDFにはjsPDFを使う。
解析画面や書き出し処理の大きなモジュールは、必要になった時点で読み込む。
版番号の一覧は[package.json](../package.json)と[pnpm-lock.yaml](../pnpm-lock.yaml)を正本とする。

## 外部由来のUI部品を更新する

相対的な面の高さを扱う仕組みは、Fluid Functionalismの`@fluid/elevated`レジストリ項目を基にしている。
[components.json](../components.json)に`@fluid`を登録し、次のファイルに上流由来の実装を置く。

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

## Cloudflareへ公開する

このフォークはCloudflare Workers Static Assetsで公開する。
アプリ用WorkerやバックエンドAPIは置かず、WranglerでViteの`dist/`をアップロードする。
公開先アカウントの権限を確認してから、次を実行する。`pnpm deploy`は公開内容を変更する。

```bash
pnpm build
pnpm deploy
```

Wranglerは開発依存関係に含まれ、ロックファイルの版を使用する。
[wrangler.jsonc](../wrangler.jsonc)は`workers.dev`ルートを有効にし、独自ドメインはCloudflare側で設定する。
存在しないパスは`public/404.html`を返す。アプリの画面へ一律に転送する設定ではない。

ビルドには`ffmpeg.wasm`を含めない。書き出しはブラウザー標準APIとgif.jsを使うため、
旧`ffmpeg-core.wasm`のサイズ制限を公開条件に含める必要はない。
Viteは依存コードの通知を`dist/licenses/third-party.md`へ生成する。
同梱・別経路で読み込むコードの通知は[additional-notices.md](../public/licenses/additional-notices.md)で管理する。

<h2 id="english">English: development and deployment</h2>

Use Node.js 24.21.0 and pnpm 12.5.1 as recorded in `.node-version` and `package.json`.
The declared engine minimums are Node.js 24.21.0 and pnpm 12.0.0. Clone this fork, run `fnm install`
and `fnm use` if using fnm, install with `pnpm install --frozen-lockfile`, then run `pnpm dev`.
All commands on this page run from the repository root. Open the URL printed by Vite.

### Checks

`pnpm check` runs formatting, lint, type checking, unit tests, and the production build in order.
The individual commands are `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, and
`pnpm build`. Use `pnpm format` to apply formatting, inspect the resulting diff, and use `pnpm test`
for Vitest watch mode. `pnpm preview` serves the built `dist/` locally.

Browser tests are separate: install Chromium with `pnpm exec playwright install --with-deps chromium`,
then run `pnpm test:e2e`. CI uses frozen dependency installation and separate quality/browser jobs.
See [the workflow](../.github/workflows/ci.yml), [Playwright configuration](../playwright.config.ts),
and [fixture guide](../e2e/fixtures/README.md#english). Historical fixture measurements are not evidence
that a later change passed its tests.

### Architecture

React, TypeScript, and Tailwind CSS provide the UI; Zustand owns state. `src/components/` groups
comparison, export, layout, media, preview, timeline, scopes, and shared UI. `src/stores/` holds state
and `src/hooks/` coordinates playback, ProRes, and UI behavior. `src/types/` defines shared types.

`src/lib/audio/` handles loudness, waveform, and stereo analysis. `src/lib/media/` handles probing,
decoding, and timeline mapping; `src/lib/difference/` contains difference-analysis processing.
`src/lib/webgl/` contains comparison, scope, and transition renderers/shaders. `metrics.ts` computes
SSIM/PSNR; `mp4Encoder.ts` and `gifEncoder.ts` implement output encoding.

Native media uses the browser pipeline; ProRes uses Mediabunny/TurboRes. Output uses WebCodecs or
MediaRecorder, Mediabunny for MP4 muxing, gif.js for GIF, and jsPDF for PDF. Heavy comparison and export
modules load on demand. Consult `package.json` and `pnpm-lock.yaml` for versions rather than a copied
version table. Keep manifest and lockfile changes consistent.

### External surface components

Fluid Functionalism's `@fluid/elevated` registry item supplies the relative-elevation implementation.
`components.json` registers `@fluid`. Upstream-derived files are `src/lib/surface-context.ts`,
`surface-provider.tsx`, `surface-classes.ts`, and `elevated.tsx`. DualView's `asChild` adapter and
control-surface variables remain in `src/components/ui/surface.ts`.

Review registry updates with the `--diff` and `--dry-run` commands above. After accepting and applying
an update, preserve project behavior in the adapter, retain license notices, and run `pnpm check`.

### Deployment

Verify access to the intended Cloudflare account before deployment: `pnpm deploy` changes the
published application. Run `pnpm build`, then `pnpm deploy`. Wrangler is a locked development
dependency and uploads Vite's `dist/` as Workers Static Assets; there is no application Worker or backend API.

`wrangler.jsonc` enables the production `workers.dev` route. Custom domains are assigned through
Cloudflare and can be removed without repository changes. Missing paths use `public/404.html` rather
than an application-shell fallback. The bundle excludes `ffmpeg.wasm`; browser-native APIs and gif.js
handle exports, so the former `ffmpeg-core.wasm` size restriction does not apply.

Vite generates `dist/licenses/third-party.md` for bundled dependencies. Keep notices for vendored or
separately loaded code in [additional-notices.md](../public/licenses/additional-notices.md).

<h2 id="citation">引用 / Citation</h2>

このフォークの引用情報は[CITATION.cff](../CITATION.cff)に置く。原作者Gökay Aydoğanへの帰属と、
花雪 / HanaYukiがこのフォークを保守していることを区別する。
GitHubの`Cite this repository`でも同じ情報を取得できる。

[CITATION.cff](../CITATION.cff) credits original creator Gökay Aydoğan and identifies 花雪 / HanaYuki as
this fork's maintainer. GitHub's `Cite this repository` reads that metadata. The matching BibTeX is:

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
