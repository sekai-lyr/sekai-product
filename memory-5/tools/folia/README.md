# Sekai Folia Sonnet integration

## Additional gallery (2026-10-13)

`gallery.tsx` adapts all fourteen upstream built-in renderers as separate modes after
the four existing modes. `gallery-upstream/` is the unmodified dependency closure.
`gallery-ui.css` isolates upstream utilities in Shadow DOM and restores transform
defaults and shader canvas sizing there. Classic/Partita long lines use a smaller
font and extra row spacing. Plain LRC is line-timed, not genuine word-timed karaoke.
Custom Cappella avatars/emoji and Monet portraits stay in browser IndexedDB.

Install the dependencies from `gallery-package.json` and its lock in
`D:/dsh-render/folia-sekai-build`, then run:

```powershell
node tools/folia/build-gallery.mjs
node D:/dsh-render/folia-sekai-build/node_modules/@tailwindcss/cli/dist/index.mjs -i tools/folia/gallery-ui.css -o src/main/resources/static/js/vendor/folia-gallery/gallery-ui.css --minify
node tools/folia/gallery-qa.mjs
```

Set `FOLIA_SOURCE` to the included `tools/folia/gallery-upstream` directory to rebuild
without an external upstream checkout. The adapter and integration styles were
modified by Sekai; the upstream files retain their original notices/license.
The browser QA checks loading and lyric-index seeks, not pixel-perfect equivalence
or every possible animation frame. URL-embedded backgrounds are not enabled.

The fourth mode (`mode=folia`) runs Folia's original Sonnet Pixi renderer, not the former Sekai article canvas.
Upstream: https://github.com/chthollyphile/folia-major
Source snapshot package version: 0.7.16. The unmodified dependency closure is in `upstream/`.
Upstream license: AGPL-3.0, preserved in `upstream/LICENSE` and served with the browser bundle.

`entry.ts` is the Sekai adapter: DOM lyric rows become Folia lines, the original compiler generates paragraphs and shots,
and the existing Sekai timeline calls `renderOnce()` with absolute audio time. Pixi's independent ticker stays paused.
Plain LRC has line timestamps only: a whole line is available at its start. Character timings are not fabricated.
Songs without timed lyrics still need lyrics before they can have a lyric performance.

Build dependencies are kept on D to conserve workspace disk space:

```powershell
npm install --prefix D:/dsh-render/folia-sekai-build --cache D:/dsh-render/folia-sekai-build/npm-cache --registry https://registry.npmjs.org --no-audit --no-fund esbuild pixi.js@8.21.0 @chenglou/pretext@0.0.9 react react-dom lucide-react
node tools/folia/build.mjs
Copy-Item src/main/resources/static/js/vendor/* target/classes/static/js/vendor/
```

The release bundle is served locally; loading a song makes no request to GitHub or a CDN.
`qa.mjs` verifies actual player pages and saves screenshots/report to D:/dsh-render/qa-sonnet-20261011.
The dependency package lock is included alongside the source distribution.
