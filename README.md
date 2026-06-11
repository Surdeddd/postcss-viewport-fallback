# postcss-viewport-fallback

[![npm version](https://img.shields.io/npm/v/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![npm downloads](https://img.shields.io/npm/dm/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![CI](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml/badge.svg)](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/postcss-viewport-fallback)](https://github.com/Surdeddd/postcss-viewport-fallback/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/postcss-viewport-fallback)](https://nodejs.org)

A PostCSS plugin that automatically inserts classic viewport unit fallbacks for modern viewport units:

- `dvw`, `dvh`, `dvi`, `dvb`, `dvmin`, `dvmax` (dynamic)
- `svw`, `svh`, `svi`, `svb`, `svmin`, `svmax` (small)
- `lvw`, `lvh`, `lvi`, `lvb`, `lvmin`, `lvmax` (large)

The plugin ensures consistent layout behavior across older browsers and embedded environments by generating `vw`, `vh`, `vi`, `vb`, `vmin`, `vmax` equivalents before the original declaration.

---

## Features

### Core Transformation

- Inserts fallback **before** the original value  
  (e.g., `height: 100vh; height: 100dvh;`)
- Works inside:
  - `calc()`
  - `min()`, `max()`, `clamp()`
  - Nested functions of any depth
  - `var(--x, 100dvh)`
- Supports decimals and negative values
- Safe parsing with `postcss-value-parser`
- Fully configurable:
  - `replace` mode (replace instead of duplicate)
  - Property allowlist (`onlyProperties`)
  - Property denylist (`excludeProperties`)
  - Custom props transformation

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

## Options

```js
viewportFallback({
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

The plugin works with Tailwind out of the box. Add it to your PostCSS config alongside Tailwind:

```js
export default {
  plugins: [
    tailwindcss(),
    viewportFallback(),
  ],
};
```

Tailwind's `h-dvh`, `min-h-dvh`, `max-h-dvh` utilities will automatically get `vh` fallbacks.

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
