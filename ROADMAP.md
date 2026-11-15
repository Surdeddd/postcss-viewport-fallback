# Roadmap

Русская версия: [ROADMAP.ru.md](./ROADMAP.ru.md)

## What the plugin does today

- Fallbacks for **all 18** viewport units of CSS Values 4 (`sv*`, `lv*`, `dv*` × `w/h/i/b/min/max`), at any depth of `calc()`, `min()`, `max()`, `clamp()`, with or without whitespace around operators
- Two strategies: `duplicate` (a static twin, nothing to ship) and `css-var` (`calc(var(...))`, a seed, and an optional 1.1 KB runtime written in ES5 syntax that gives legacy browsers live `dv*` values)
- Values with `var()` / `env()` and custom properties get a fallback that really applies: the fallback stays in the rule, the original moves under `@supports` together with the later declarations that can meet it
- A table of shorthands, longhands, aliases and flow-relative properties, built from the CSS specifications and compared with Chrome, tells which declarations can meet: only those are repeated, and a property the table does not know is treated as related to every other one
- One `@supports (height: 1dvh)` probe for all built-in units; neighbouring declarations share a block
- `@media`, `@import` and `@custom-media` get the lowered query as one more entry of the list; `@container` gets a twin rule; `@keyframes` with `var()` values and `@property` with an `initial-value` are repeated under `@supports`, once for every step of a unit chain
- `@supports` feature queries are never rewritten, and what they guard gets no fallback; conditions with `not`, `and`, `or` are evaluated for the units they guarantee
- A fallback you wrote yourself is recognised where it holds the same place in the cascade, also across declarations of unrelated properties (`existingFallback: 'exact' | 'any'`)
- Logical units fall back to physical ones by default (`logicalFallback`)
- CSS-in-JS fragments can take nested `@supports` blocks (`fragmentGuards`); the css-var seed can be shipped once (`seed: false` + `postcss-viewport-fallback/seed.css`)
- Custom unit mapping (`customUnits`), with chains and cycle detection
- `browserslist` auto-skip, resolved for every processed file; `fastSkip`
- Property filters, point and range control comments, `strict` mode for CI, debug presets, `onTransform` / `onComplete`
- Options are validated when the plugin is created, unknown names included; messages in English or Russian (`PVF_LANG=ru`)
- Works after the plugins that visit nodes (`postcss-nesting`, `postcss-logical`, `postcss-preset-env`), so that their order in the config does not change the result
- Loads through `postcss-load-config`, `import` and `require`; accurate source maps; safe to run on many files at once
- A [playground](https://surdeddd.github.io/postcss-viewport-fallback/) runs the plugin in the browser: paste CSS, switch options, see which lines the plugin wrote, copy the config or a link to the result

## Ideas under consideration

### Dropping the `@container` twin

Once lists of container conditions are supported widely, `@container` can get the same treatment as `@media`: one more condition in the list instead of a second rule.

### Custom units in the runtime

The runtime covers the built-in units. It could take the `customUnits` map and keep those variables live too.

### `@keyframes` and `@property` per combination of probes

Such a rule is repeated as a whole, so values that need different probes, two unrelated `customUnits` for instance, are upgraded together: a browser that knows only one of the units keeps the fallback for both. A copy for every combination of probes would upgrade each value on its own, at the cost of up to 2ⁿ − 1 copies. Worth it once someone maps several independent units.

### A seed that reaches every style attribute

With `css-var`, the seed for `style=""` attributes goes into the first `<style>` block of the document. When that block does not apply to the element (a `media` attribute, a shadow root), the attribute keeps the fallback even in browsers that know the unit. Picking a block that applies, or warning when none can be found, would close the gap.

### Discovery

A listing on [postcss.org](https://postcss.org/docs/postcss-plugins) and standalone recipe pages for the common frameworks.

### An ESM-only package

Worth considering once Node 20 is out of support.

## Explicitly out of scope

- **Rewriting `@supports` feature queries.** 1.x turned `@supports (height: 100dvh)` into an extra `@supports (height: 100vh)` block. That un-gates styles the author gated on purpose and breaks hand-written ladders, so 2.0 removed it for good.
- **Gating the lowered media query.** Wrapping it in `@supports not (height: 1dvh)` would keep modern browsers from evaluating it, at the price of duplicating the block again — the very thing the query list avoids. The narrow case it would fix is described under "Known limitations" in the README.
- **An advisory or lint mode.** Warning about `dvh` on fixed or animated elements is a job for a stylelint rule, not for a transform.
- **Inline style objects in JSX, Angular or Svelte.** They need a compiler plugin, not PostCSS. `postcss-html` already covers `<style>` blocks and `style=""` attributes.
- **A `-webkit-fill-available` mode.** An end-of-life technique (WebKit only, breaks in `calc()`, height only) for a population well under 1%. `postcss-100vh-fix` owns that niche.
- **LightningCSS integration.** LightningCSS deliberately does not lower viewport units ([issue #534](https://github.com/parcel-bundler/lightningcss/issues/534)); this plugin runs fine next to it.
