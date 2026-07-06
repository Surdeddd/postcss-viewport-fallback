# Roadmap

## Current Capabilities (built-in)

The plugin already supports the following features out of the box:

- Fallback transformation for **all 18** CSS Values 4 viewport units (`sv*`, `lv*`, `dv*` × `w/h/i/b/min/max`)
- Two strategies: `duplicate` (zero-runtime twin declaration) and `css-var` (pixel-perfect `calc(var(...))` + `@supports` seed + optional runtime)
- Dependency-free ~1 KB browser runtime (`postcss-viewport-fallback/runtime`) for pixel-perfect legacy fallbacks
- Custom unit mapping via `customUnits` (chains allowed, cycles rejected at init)
- Works inside functions: `calc()`, `min()`, `max()`, `clamp()`, nested to any depth
- Fallback generation inside `@media`, `@supports`, `@container` params
- Case-insensitive matching; scientific-notation and signed numbers
- Correct handling of edge cases: strings, `url()`, invalid/malformed values, idents containing a unit substring
- Property allowlist (`onlyProperties`) / denylist (`excludeProperties`), single value or array
- `browserslist` auto-skip (boolean or query) + `fastSkip` per-file early-exit
- Point (`off`) and range (`disable`/`enable`) control comments, cascading into nested blocks
- Debug presets, `onTransform` / `onComplete` callbacks, `strict` CI mode
- Dedup optimization, per-run stats isolation (concurrent-safe via `prepare()`)

These capabilities require no additional syntax plugins and work on pure CSS input.

---

## Ideas Under Consideration

### Advisory / lint mode

An opt-in `advise: true` that warns (via `result.warn()`) on likely-wrong usage: `dvh` on `position: fixed` or animated properties (jank), suggesting `svh`; flagging the Safari 15.6 `dvh` bug. Turns the plugin from a transform into a viewport-units authority.

### Interactive playground

A static page (the plugin runs in-browser via postcss standalone) to paste CSS, toggle options, and see output — the pattern that converts skeptics for preset-env and LightningCSS.

### Discovery

List on [postcss.org plugins](https://postcss.org/docs/postcss-plugins); framework recipe pages (Vite, Next, Nuxt, Astro).

---

## Explicitly Out of Scope

- **JSX/Angular/Svelte inline-style-object transforms** — require a Babel/compiler plugin, not PostCSS; no observed demand. `postcss-html` already covers `<style>` blocks in HTML/Vue/Svelte SFCs.
- **`-webkit-fill-available` mode** — end-of-life technique (WebKit-only, breaks in `calc()`, height-only); its target population (iOS < 15.4) is well under 1% and shrinking. `postcss-100vh-fix` owns that niche.
- **LightningCSS integration** — LightningCSS deliberately does **not** lower viewport units ([issue #534](https://github.com/parcel-bundler/lightningcss/issues/534); the maintainer considers static `dvw → vw` incorrect and a real polyfill JS-dependent). This is a differentiation opportunity for `strategy: 'css-var'`, not something to defer to.

> Correction: earlier versions of this file claimed "LightningCSS handles viewport fallbacks natively." That was false — it does not, and has declined to.

---
