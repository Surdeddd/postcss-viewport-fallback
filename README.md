# postcss-viewport-fallback

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
  replace: false,
  includeCustomProps: false,
  onlyProperties: undefined,
  excludeProperties: undefined,
  debug: false,
  onTransform(meta) {
    console.log(meta);
  },
});
```

### Option Details

#### replace

Replace dvh → vh without duplicating declarations.

#### includeCustomProps

Transform custom properties, e.g.:

```css
--header-height: 100dvh;
```

#### onlyProperties

Apply transformation only to selected properties.

```js
onlyProperties: ['height', 'padding'];
```

#### excludeProperties

Skip transformation for selected properties.

```js
excludeProperties: ['margin'];
```

#### debug

Prints internal plugin logs.

#### onTransform(meta)

Callback fired for every transformation.

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

## License

MIT License © 2025 Maksim Kravtsov
