# 追加の配布通知 / Additional distributed notices

ブラウザーへ配布するコードのうち、同梱・コピー・別経路での読み込みによって通常の依存関係情報だけでは扱えないものを記載します。
Viteの製品版ビルドは、バンドルした依存コードの通知を`licenses/third-party.md`へ別途生成します。
以下のライセンス本文と著作権表示は原文を掲載します。

This page records notices for browser-distributed code that is vendored, copied, or loaded outside
ordinary dependency metadata. Vite generates `licenses/third-party.md` separately for bundled
dependencies. License texts and copyright notices below are reproduced in their original form.

## gif.worker.js / gif.js-upgrade 0.2.1

`public/gif.worker.js`は製品版へコピーされます。Worker内の表記は`gif.worker.js 0.2.1`で、原プロジェクトのgif.jsを参照しています。

The production build includes `public/gif.worker.js`. Its header identifies version `gif.worker.js 0.2.1`
and refers to the original gif.js project.

- Package: `gif.js-upgrade` 0.2.1
- License: MIT
- Fixed package archive: https://registry.npmjs.org/gif.js-upgrade/-/gif.js-upgrade-0.2.1.tgz
- Original project named by the worker: https://github.com/jnordberg/gif.js

The MIT License (MIT)

Copyright (c) 2013 Johan Nordberg

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## @mediabunny/prores 1.59.0

ブラウザーアプリに同梱するProResデコーダーです。配布版の対応ソースとライセンスは以下のとおりです。

This ProRes decoder is distributed with the browser application. The links below identify its
corresponding source and license.

- Package: `@mediabunny/prores` 1.59.0
- License: Mozilla Public License 2.0 (MPL-2.0)
- Corresponding source for the distributed version:
  https://github.com/Vanilagy/mediabunny/tree/v1.59.0/packages/prores
- MPL 2.0 license text: https://www.mozilla.org/MPL/2.0/

ProResコンポーネントのMPL対象部分にはMPL-2.0が適用されます。DualView本体のMIT Licenseは変わらず、
各コンポーネントとファイルにはそれぞれのライセンスが適用されます。

MPL-covered ProRes code remains under MPL-2.0. DualView itself remains MIT-licensed; the applicable
license is determined for each component and file.

## pixelmatch 7.2.0

別ファイルとして出力する差分解析Workerは、フレームの画素比較に`pixelmatch`を同梱します。

The separately emitted difference-analysis Workers include `pixelmatch` to compare frame pixels.

- Package: `pixelmatch` 7.2.0
- License: ISC
- Project: https://github.com/mapbox/pixelmatch

ISC License

Copyright (c) 2025, Mapbox

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee
is hereby granted, provided that the above copyright notice and this permission notice appear in all
copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

## Fluid Functionalism surface system

Fluid Functionalismの`@fluid/elevated` shadcnレジストリ項目から、面のコンテキスト、クラスの参照、
高さの基本部品を取り込んでいます。`src/components/ui/surface.ts`の互換層のコードはDualView側に帰属します。

The surface context, class lookup, and elevation primitive are vendored from Fluid Functionalism's
`@fluid/elevated` shadcn registry item. DualView owns the adapter in `src/components/ui/surface.ts`.

- Project: https://github.com/mickadesign/fluid-functionalism
- Registry: https://www.fluidfunctionalism.com/r/elevated.json
- License: MIT

MIT License

Copyright (c) 2026 Micka Touillaud

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
