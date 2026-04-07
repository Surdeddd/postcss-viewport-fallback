# postcss-viewport-fallback

[![npm version](https://img.shields.io/npm/v/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![npm downloads](https://img.shields.io/npm/dm/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![CI](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml/badge.svg)](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/postcss-viewport-fallback)](https://github.com/Surdeddd/postcss-viewport-fallback/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/postcss-viewport-fallback)](https://nodejs.org)

A PostCSS plugin that automatically inserts classic viewport unit fallbacks for modern dynamic viewport units:

- `dvh`, `dvw`
- `lvh`, `svh`
- `dvi`, `dvb`

The plugin ensures consistent layout behavior across older browsers and embedded environments by generating `vh`, `vw`, `vi`, `vb` equivalents before the original declaration.

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

#### Example:

```css
@media (min-height: 100dvh) { ... }
/* becomes */
@media (min-height: 100vh) { ... }
@media (min-height: 100dvh) { ... }
```

## Example:

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
  browserslist: false,     // auto-skip if all targets support dvh
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

> **Note:** `replace: true` still works as a deprecated alias for `preserve: false`.

#### includeCustomProps

Transform custom properties, e.g.:

```css
--header-height: 100dvh;
```

#### onlyProperties

Apply transformation only to selected properties. Accepts strings and RegExp patterns:

```js
onlyProperties: ['height', /^(min|max)-height$/]
```

#### excludeProperties

Skip transformation for selected properties. Same format as `onlyProperties`:

```js
excludeProperties: [/^padding/, 'margin']
```

#### browserslist

Auto-skip the entire plugin if all target browsers support dynamic viewport units. Requires `caniuse-api` as an optional dependency:

```bash
npm install caniuse-api --save-dev
```

```js
browserslist: true
```

#### debug

Controls logging output:

- `false` — no output (default)
- `true` or `'verbose'` — per-transform warnings + summary with timing
- `'minimal'` — summary only (e.g., `"3 declarations, 1 at-rules transformed (0.42ms)"`)

Output is emitted via PostCSS `result.warn()`, so it integrates with postcss-reporter and other PostCSS tooling.

#### strict

Throws an error with source position when dynamic viewport units are found. Useful for CI pipelines to enforce that all viewport units have been manually reviewed.

#### customUnits

Add custom unit-to-fallback mappings beyond the built-in ones:

```js
customUnits: { cqh: 'vh', cqw: 'vw' }
```

Custom units are merged with built-in units. You can also override built-in mappings.

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

---

## Supported units

| Modern unit | Fallback |
| ----------- | -------- |
| dvh         | vh       |
| dvw         | vw       |
| lvh         | vh       |
| svh         | vh       |
| dvi         | vi       |
| dvb         | vb       |

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

## License

MIT License © 2025 Maksim Kravtsov
