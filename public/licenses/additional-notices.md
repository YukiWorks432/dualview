# Additional distributed notices

This file covers browser-distributed files that are copied or loaded outside the normal Vite bundle
path. The Vite production build also generates `licenses/third-party.md` for bundled dependencies.

## gif.worker.js / gif.js-upgrade 0.2.1

DualView copies `public/gif.worker.js` into the production output. The distributed worker identifies
itself as `gif.worker.js 0.2.1` and points to the original gif.js project.

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

DualView uses the ProRes decoder package distributed with the browser application.

- Package: `@mediabunny/prores` 1.59.0
- License: Mozilla Public License 2.0 (MPL-2.0)
- Corresponding source for the distributed version:
  https://github.com/Vanilagy/mediabunny/tree/v1.59.0/packages/prores
- MPL 2.0 license text: https://www.mozilla.org/MPL/2.0/

The MPL-covered ProRes component remains under MPL-2.0. Its inclusion does not change the overall
DualView application license from MIT; the applicable license follows each covered component and
file.

## pixelmatch

The timeline analysis worker includes pixelmatch (ISC, Copyright (c) 2025, Mapbox). See [the full license](pixelmatch-license.txt) and [the upstream source](https://github.com/mapbox/pixelmatch/tree/v7.2.0). This notice is included explicitly for the separately bundled worker.
