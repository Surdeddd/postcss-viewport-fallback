# postcss-viewport-fallback

[![npm version](https://img.shields.io/npm/v/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![npm downloads](https://img.shields.io/npm/dm/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![CI](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml/badge.svg)](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/postcss-viewport-fallback)](https://github.com/Surdeddd/postcss-viewport-fallback/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/postcss-viewport-fallback)](https://nodejs.org)

The universal fallback layer for modern CSS viewport units — all 18 of them:

- `dvw`, `dvh`, `dvi`, `dvb`, `dvmin`, `dvmax` (dynamic)
- `svw`, `svh`, `svi`, `svb`, `svmin`, `svmax` (small)
- `lvw`, `lvh`, `lvi`, `lvb`, `lvmin`, `lvmax` (large)

Two strategies, one plugin:

- **`duplicate`** (default, zero-runtime) — inserts a classic `vh`/`vw`/... twin before the original declaration; old browsers use the twin, modern browsers use the real unit
- **`css-var`** (pixel-perfect) — rewrites units to `calc(var(--pvf-dvh, 1vh) * N)` with an auto-injected `@supports` seed, optionally paired with a ~1 KB runtime that gives legacy browsers *actually dynamic* values

Works in `calc()`, `@media`/`@supports`/`@container` params, nested CSS, Tailwind output, Vue/Svelte SFCs.

---

## Features

### Core Transformation

- All **18** viewport units — dynamic, small, and large × `w/h/i/b/min/max`
- Two [strategies](#strategy): zero-runtime `duplicate` twins, or pixel-perfect `css-var` + runtime
- Works inside `calc()`, `min()`, `max()`, `clamp()`, and nested functions of any depth
- Decimals, negative and signed values, scientific notation, case-insensitive units
- Safe parsing with `postcss-value-parser` — never touches strings, `url()`, or idents
- Fully configurable: `preserve`, `onlyProperties`, `excludeProperties`, `customUnits`, `includeCustomProps`
- Performance: `browserslist` auto-skip, `fastSkip` per-file scan, dedup, concurrent-safe stats

### At-Rule Support

Fallback generation inside:

- `@media`
- `@supports`
- `@container` (including nested container queries)

#### At-rule example

```css
@media (min-height: 100dvh) { ... }
/* becomes */
@media (min-height: 100vh) { ... }
@media (min-height: 100dvh) { ... }
```

## Example

### Input

```css
.app {
  height: 100dvh;
  width: calc(100dvw - 20px);
}
```

### Output

```css
.app {
  height: 100vh;
  height: 100dvh;
  width: calc(100vw - 20px);
  width: calc(100dvw - 20px);
}
```

---

## Do you still need this in 2026?

Dynamic viewport units are [Baseline Widely Available](https://caniuse.com/viewport-unit-variants) (~93% global support: Chrome 108+, Safari 15.4+, Firefox 101+). For a typical US/EU consumer app the fallback is close to optional.

You **do** still need it if your `browserslist` includes any of:

- **Emerging-market browsers** — Opera Mini (no support, ever), UC Browser, QQ, KaiOS
- **Smart-TV / digital-signage** — Tizen & webOS pin Chromium per model year; 2016–2022 TVs never reach Chromium 108
- **Embedded WebViews / kiosks / car head units** stuck on pre-108 Chromium
- **Long-tail / public-sector device matrices** that keep old iOS & Android in scope

The honest pitch: *if you don't need it, `browserslist: true` makes the plugin cost exactly zero. If you do, it's the most complete option available.* See the [comparison](#comparison) below.

---

## Options

```js
viewportFallback({
  strategy: 'duplicate',   // or 'css-var' (pixel-perfect, pairs with the runtime)
  preserve: true,          // false removes original dvh, keeps only vh fallback
  includeCustomProps: false,
  onlyProperties: undefined,   // string | RegExp | Array<string | RegExp>
  excludeProperties: undefined,
  debug: false,            // or 'minimal' | 'verbose'
  strict: false,
  customUnits: undefined,  // e.g. { cqh: 'vh', cqw: 'vw' }
  browserslist: false,     // true | browserslist query — auto-skip if all targets support dvh
  fastSkip: false,         // skip files without viewport units via one regex scan
  onTransform(meta) {
    console.log(meta);
  },
  onComplete(stats) {
    console.log(stats); // { declarations, atRules, skipped, timeMs }
  },
});
```

### Option Details

#### strategy

How declaration fallbacks are produced (default: `'duplicate'`).

**`'duplicate'`** — the classic, zero-runtime approach. Inserts a static twin declaration before the original:

```css
/* height: 100dvh  →  */
height: 100vh;
height: 100dvh;
```

Old browsers keep the last value they understand (`100vh`); modern browsers use `100dvh`. Nothing to ship, works everywhere. Best default for most projects.

**`'css-var'`** — pixel-perfect fallback for legacy browsers. Rewrites each unit to a `calc()` over a CSS variable and injects a `:root` seed that upgrades to the real unit via `@supports`:

```css
/* input */
.sheet { height: 100dvh; }

/* output */
:root { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root { --pvf-dvh: 1dvh } }
.sheet { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }
```

On its own this behaves like `duplicate` (falls back to `1vh`). Its power comes from pairing it with the **runtime** (below), which sets `--pvf-dvh` from the *actual* viewport in browsers that lack `dvh` — so `100dvh` resolves to true pixel height, not the static `vh` approximation that ignores mobile browser chrome.

At-rule params (`@media (min-height: 100dvh)`) always use the `duplicate` strategy, because `var()`/`calc()` are invalid in feature-query context.

#### The runtime (for `strategy: 'css-var'`)

A dependency-free ~1 KB module. Import it once at your app entry:

```js
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';

applyViewportVars(); // no-op in browsers that support dvh
```

In browsers **with** native `dv*` support it detects `CSS.supports('height','1dvh')` and does nothing (the `@supports` seed already handles them). In browsers **without** it, it measures `visualViewport` (falling back to `innerWidth/Height`), sets every `--pvf-*` variable to 1% of the live dimension, tracks small/large extremes across resizes, and honors vertical writing modes for `vi`/`vb`. Returns `{ update, destroy }` for manual control and SPA teardown. SSR-safe (no-op without `window`).

Framework entry points:

```js
// Vite / plain
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';
applyViewportVars();

// Next.js — app/layout.tsx (client component) or a <Script> tag
'use client';
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';
applyViewportVars();
```

> If your target browsers all support `dvh` (or you're happy with the static `vh` approximation), stick with the default `duplicate` strategy and skip the runtime entirely.

#### preserve

Keep the original modern declaration alongside the fallback (default: `true`).

Set to `false` to output only the fallback — useful when targeting only older browsers:

```js
// Input:  height: 100dvh;
// Output: height: 100vh;   (original removed)
preserve: false
```

Applies to at-rules too: `@media (min-height: 100dvh)` is replaced by its `vh` fallback block.

> **Note:** `replace: true` still works as a deprecated alias for `preserve: false`.

#### includeCustomProps

Transform custom properties, e.g.:

```css
--header-height: 100dvh;
```

#### onlyProperties

Apply transformation only to selected properties. Accepts a string, a RegExp, or an array of both:

```js
onlyProperties: ['height', /^(min|max)-height$/]
onlyProperties: 'height'
```

#### excludeProperties

Skip transformation for selected properties. Same format as `onlyProperties`:

```js
excludeProperties: [/^padding/, 'margin']
```

> At-rules participate in property filters under the names `@media`, `@supports`, `@container`. For example, `excludeProperties: ['@media']` skips media query params, and `onlyProperties: ['height']` disables at-rule transformation entirely (the allowlist doesn't include `@media`).

#### browserslist

Auto-skip the entire plugin if all target browsers (resolved from your browserslist config) support dynamic viewport units. Requires `caniuse-api` as an optional dependency:

```bash
npm install caniuse-api --save-dev
```

```js
browserslist: true                  // resolve targets from project browserslist config
browserslist: 'last 2 versions'     // or pass a query directly
browserslist: ['chrome >= 120', 'safari >= 17']
```

If `caniuse-api` is not installed or no browserslist config is found, the plugin keeps transforming as usual.

#### fastSkip

Skip whole files that contain no viewport units using a single regex scan over the raw source, instead of visiting every declaration (default: `false`):

```js
fastSkip: true
```

> **Warning:** do not enable when an earlier plugin in the same PostCSS pipeline *generates* viewport units that are not present in the source file — e.g. Tailwind producing `h-dvh` utilities from `@tailwind utilities`. The scan only sees the original source.

#### debug

Controls logging output:

- `false` — no output (default)
- `true` or `'verbose'` — per-transform warnings + summary with timing
- `'minimal'` — summary only (e.g., `"3 declarations, 1 at-rules transformed (0.42ms)"`)

Output is emitted via PostCSS `result.warn()`, so it integrates with postcss-reporter and other PostCSS tooling.

#### strict

Throws an error with source position when dynamic viewport units are found. Useful for CI pipelines to enforce that all viewport units have been manually reviewed.

Strict throws exactly where a transform would otherwise happen — declarations and at-rules that are skipped by `excludeProperties`/`onlyProperties`, custom properties without `includeCustomProps`, and idents that merely contain a unit substring (e.g. `var(--dvh-color)`) do not trigger it.

#### customUnits

Add custom unit-to-fallback mappings beyond the built-in ones:

```js
customUnits: { cqh: 'vh', cqw: 'vw' }
```

Custom units are merged with built-in units. You can also override built-in mappings. Chains are allowed (`cqh → svh → vh` produces progressive fallbacks); mapping cycles (e.g. `{ dvh: 'svh', svh: 'dvh' }`) are rejected at plugin init.

#### onTransform(meta)

Callback fired for every transformation (declarations and at-rules).

#### onComplete(stats)

Callback fired after processing with statistics:

```js
onComplete(stats) {
  console.log(stats.declarations); // fallback declarations added
  console.log(stats.atRules);      // at-rule fallbacks added
  console.log(stats.skipped);      // dedup skips
  console.log(stats.timeMs);       // processing time in ms
}
```

---

## Control Comments

Disable transformation for a specific declaration by placing a comment before it:

```css
.app {
  /* postcss-viewport-fallback: off */
  height: 100dvh; /* will NOT get a fallback */
  width: 50dvw;   /* will get a fallback */
}
```

Or disable a whole range with `disable` / `enable` (applies to all following siblings and cascades into nested blocks):

```css
/* postcss-viewport-fallback: disable */
.hero { height: 100dvh; }                          /* skipped */
@media (min-height: 50dvh) { .x { width: 10dvw; } } /* skipped, including contents */
/* postcss-viewport-fallback: enable */
.app { height: 100dvh; }                           /* gets a fallback */
```

---

## Supported units

All small (`sv*`), large (`lv*`), and dynamic (`dv*`) viewport units from [CSS Values 4](https://www.w3.org/TR/css-values-4/#viewport-relative-units):

| Modern units        | Fallback |
| ------------------- | -------- |
| dvw, svw, lvw       | vw       |
| dvh, svh, lvh       | vh       |
| dvi, svi, lvi       | vi       |
| dvb, svb, lvb       | vb       |
| dvmin, svmin, lvmin | vmin     |
| dvmax, svmax, lvmax | vmax     |

Matching is case-insensitive (`100DVH` → `100vh`), per CSS spec.

> **Honest note on `vi`/`vb` fallbacks:** logical viewport units (`vi`, `vb`) shipped in browsers at roughly the same time as their dynamic variants (Chromium 108, Safari 15.4) — a browser missing `dvi` almost certainly also misses `vi`. The practical value of this plugin is in the `vh`/`vw`/`vmin`/`vmax` fallbacks; `vi`/`vb` mappings are provided for completeness.

---

## Comparison

| | **postcss-viewport-fallback** | postcss-100vh-fix | postcss-viewport-unit-fallback | LightningCSS | postcss-preset-env |
| --- | :---: | :---: | :---: | :---: | :---: |
| All 18 `sv*`/`lv*`/`dv*` units | ✅ | ❌ (100vh only) | ⚠️ height units only | ❌ | ❌ |
| `dvw`/width & logical units | ✅ | ❌ | ❌ | ❌ | ⚠️ `vi`/`vb` only |
| Inside `calc()`/`min()`/`clamp()` | ✅ | ❌ | ❌ | — | — |
| `@media`/`@supports`/`@container` | ✅ | ❌ | ❌ | — | — |
| Preserves `!important` | ✅ | ✅ | ❌ ([bug](https://github.com/gooodev/postcss-viewport-unit-fallback/issues/1)) | — | — |
| Pixel-perfect runtime option | ✅ (`css-var`) | ❌ | ❌ | ❌ | ❌ |
| `browserslist` auto-skip | ✅ | ❌ | ❌ | ✅ (targets) | ✅ (stage) |
| Actively maintained | ✅ | ⚠️ | ❌ (2023) | ✅ | ✅ |

- **LightningCSS** does not lower viewport units and [won't](https://github.com/parcel-bundler/lightningcss/issues/534) — the maintainer's position is that `dvw → vw` isn't a correct static lowering and a proper polyfill needs JavaScript (which is exactly what `strategy: 'css-var'` + the runtime provides).
- **Autoprefixer** only adds vendor prefixes; units are not prefixable, so it never touches them.
- **postcss-100vh-fix** solves the older iOS `-webkit-fill-available` problem (height-only, breaks in `calc()`); it's orthogonal, not a `dvh` fallback.

---

## Gotchas worth knowing

Being *the* viewport-units tool means being honest about their sharp edges — a fallback plugin can't fix these, but you should know them:

- **`dvh` doesn't react to the on-screen keyboard.** By default the dynamic viewport ignores the virtual keyboard. Opt in with `<meta name="viewport" content="interactive-widget=resizes-content">` (Chromium-only today).
- **`dvh` can jank.** Some browsers debounce dynamic viewport updates rather than tracking at 60fps. For sticky/animated elements, `svh` (smallest viewport) is often the calmer choice than `dvh`.
- **`svh` vs `dvh`:** `svh` assumes browser chrome is *visible* (safe, never clipped); `dvh` follows the live viewport (uses all space, but shifts). Pick `svh` for guaranteed-visible content, `dvh` for full-bleed.
- **Safari 15.6 (macOS)** has a known bug where `dvh` renders larger than expected ([WebKit #242758](https://bugs.webkit.org/show_bug.cgi?id=242758)).

---

## Installation

```bash
npm install postcss-viewport-fallback --save-dev
```

---

## Usage (PostCSS Config)

```js
import viewportFallback from 'postcss-viewport-fallback';

export default {
  plugins: [viewportFallback()],
};
```

---

## Usage with Frameworks

### Tailwind CSS

Tailwind has [declined](https://github.com/tailwindlabs/tailwindcss/discussions/12752) to emit `vh` fallbacks for its `dvh` utilities — this plugin is the answer. **Order matters:** list `viewportFallback` *after* Tailwind so it transforms the generated `h-dvh` / `min-h-dvh` / `max-h-dvh` output:

```js
// postcss.config.js — Tailwind v3
export default {
  plugins: {
    tailwindcss: {},
    'postcss-viewport-fallback': {},
  },
};
```

```js
// Tailwind v4 (@tailwindcss/postcss)
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-viewport-fallback': {},
  },
};
```

Because Tailwind generates utilities *during* the build (they aren't in your source), leave `fastSkip` off for the Tailwind entry — the raw-source scan wouldn't see them.

### Vue / Nuxt

Works with `<style>` blocks in `.vue` files without extra configuration — `vue-loader` and Vite handle PostCSS natively.

### Svelte / SvelteKit

Works with `<style>` blocks in `.svelte` files. Vite and svelte-preprocess apply PostCSS automatically.

### styled-components / Emotion (CSS-in-JS)

For template literal CSS-in-JS, configure `postcss-jsx` as a syntax plugin:

```js
import postcssJsx from 'postcss-jsx';

export default {
  plugins: [viewportFallback()],
  syntax: postcssJsx,
};
```

### HTML inline styles

For `<style>` tags in `.html` files, use `postcss-html`:

```js
import postcssHtml from 'postcss-html';

export default {
  plugins: [viewportFallback()],
  syntax: postcssHtml,
};
```

---

## Development

```bash
npm test               # vitest suite
npm run test:coverage  # suite + v8 coverage report
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # tsup → dist (esm + cjs + d.ts/d.cts)
npm run check:package  # publint + arethetypeswrong (package exports health)
npm run bench          # quick perf benchmark on 20k generated rules
```

CI runs lint, typecheck, tests (Node 20/22/24), build, and package checks on every push/PR. Coverage is reported on the Node 22 job.

### Releases

Fully automated with [semantic-release](https://github.com/semantic-release/semantic-release): every push to `main` with [Conventional Commits](https://www.conventionalcommits.org) (`fix:` → patch, `feat:` → minor, `BREAKING CHANGE` → major) runs CI and, if a release is due, bumps the version, updates `CHANGELOG.md`, tags a GitHub release, and publishes to npm with provenance — no manual steps.

---

## License

MIT License © 2025 Maksim Kravtsov
