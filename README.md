# postcss-viewport-fallback

Русская версия: [README.ru.md](https://github.com/Surdeddd/postcss-viewport-fallback/blob/main/README.ru.md)

[![npm version](https://img.shields.io/npm/v/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![npm downloads](https://img.shields.io/npm/dm/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![CI](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml/badge.svg)](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/postcss-viewport-fallback)](https://github.com/Surdeddd/postcss-viewport-fallback/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/postcss-viewport-fallback)](https://nodejs.org)

A PostCSS plugin that gives `dvh`, `svh`, `lvh` and the other fifteen dynamic viewport units a fallback that older browsers really apply.

```css
/* you write */
.app {
  height: 100dvh;
  min-height: calc(100dvh - var(--header));
}

/* browsers get */
.app {
  height: 100vh;
  height: 100dvh;
  min-height: calc(100vh - var(--header));
}
@supports (height: 1dvh) {
  .app {
    min-height: calc(100dvh - var(--header));
  }
}
```

It covers plain values, `calc()` and friends, values with `var()`, custom properties, `@media`, `@container`, `@import` conditions, `@keyframes` and `@property`, and it leaves alone what you already took care of yourself.

**[Try it in the playground](https://surdeddd.github.io/postcss-viewport-fallback/)**: paste your CSS, switch the options, read what the plugin writes.

## Install

```bash
npm install postcss-viewport-fallback --save-dev
```

```js
// postcss.config.js
import viewportFallback from 'postcss-viewport-fallback';

export default {
  plugins: [viewportFallback()],
};
```

The object form read by `postcss-load-config` (Vite, postcss-cli, postcss-loader, Next.js, Nuxt) works too, and so does `require()`:

```js
// postcss.config.cjs
module.exports = {
  plugins: {
    'postcss-viewport-fallback': {},
  },
};
```

Put the plugin **after** everything that writes viewport units: Tailwind, Sass, mixins, variables.

## Contents

- [Do you still need this?](#do-you-still-need-this)
- [What gets a fallback](#what-gets-a-fallback)
- [What is left alone](#what-is-left-alone)
- [Strategies](#strategies)
- [Options](#options)
- [Control comments](#control-comments)
- [Frameworks and tools](#frameworks-and-tools)
- [Supported units](#supported-units)
- [Comparison](#comparison)
- [Good to know about the units](#good-to-know-about-the-units)
- [Known limitations](#known-limitations)
- [FAQ](#faq)
- [Migrating from 1.x](#migrating-from-1x)
- [Development](#development)

## Do you still need this?

Dynamic viewport units are [Baseline Widely Available](https://caniuse.com/viewport-unit-variants): Chrome 108+, Safari 15.4+, Firefox 101+, about 93% of users worldwide. For a typical consumer app in the US or the EU the fallback is close to optional.

You **do** need it when your `browserslist` includes any of:

- **Browsers of emerging markets** — Opera Mini (no support, ever), UC Browser, QQ, KaiOS
- **Smart TVs and digital signage** — Tizen and webOS pin Chromium per model year; TVs from 2016–2022 never reach Chromium 108
- **Embedded WebViews, kiosks, car head units** stuck on Chromium older than 108
- **Long-tail and public-sector device lists** that keep old iOS and Android in scope

If you don't need it, `browserslist: true` makes the plugin cost nothing. If you do, this is the most complete option there is — see the [comparison](#comparison).

## What gets a fallback

### Declarations

A twin with the classic unit goes in front of the declaration. A browser that does not know `dvh` drops the second line and keeps the first.

```css
/* input */
.a {
  width: calc(100dvw - 20px);
  inset: 1svh 2lvw;
}

/* output */
.a {
  width: calc(100vw - 20px);
  width: calc(100dvw - 20px);
  inset: 1vh 2vw;
  inset: 1svh 2lvw;
}
```

This works at any depth of `calc()`, `min()`, `max()`, `clamp()`, with decimals, signs, scientific notation and any letter case, with `!important`, and without spaces around operators (`100dvh*2`, `height>=100dvh`).

### Values with `var()` or `env()`

A declaration that contains `var()` or `env()` is accepted by every browser when the stylesheet is parsed and only fails later, when the value is substituted. A twin in front of it would never be used: a browser without `dvh` keeps `calc(100dvh - var(--header))`, finds it invalid and ends up with `auto`. For these declarations the plugin puts the fallback into the rule and moves the original into an `@supports` block right after it:

```css
/* input */
.page {
  min-height: calc(100dvh - var(--header));
}

/* output */
.page {
  min-height: calc(100vh - var(--header));
}
@supports (height: 1dvh) {
  .page {
    min-height: calc(100dvh - var(--header));
  }
}
```

- A declaration further down in the same rule that can meet the upgraded one — a longhand of it, a shorthand that covers it, a flow-relative spelling such as `margin-block-start` — is repeated inside the block, so a later `margin-top` still beats an earlier `margin` shorthand. Declarations of unrelated properties stay out of it:

  ```css
  /* input */
  .card {
    margin: calc(2dvh + var(--gap));
    margin-top: 0;
    color: red;
  }

  /* output */
  .card {
    margin: calc(2vh + var(--gap));
    margin-top: 0;
    color: red;
  }
  @supports (height: 1dvh) {
    .card {
      margin: calc(2dvh + var(--gap));
      margin-top: 0;
    }
  }
  ```

  Which properties meet comes from a table built from the CSS specifications and compared with what Chrome does. A property the table has not heard of is treated as related to every other one.

- Declarations that need the same units share one block. All eighteen built-in units shipped together in every browser, so one probe, `(height: 1dvh)`, stands for all of them.
- In nested CSS the block is nested inside the rule, right after the declarations it upgrades, whenever a nested block further down sets a related property and could otherwise lose to it.
- With `strategy: 'css-var'` or `preserve: false` the value is rewritten in place and no block is needed.

Where an `@supports` block cannot be placed — a `style=""` attribute, the top level of a CSS-in-JS fragment (unless you turn on [`fragmentGuards`](#fragmentguards)), or below a nested block of the same rule that sets a related property — the declaration is left as it is and reported through `result.warn()`.

### Custom properties

Off by default, see [`includeCustomProps`](#includecustomprops). They get the same `@supports` treatment, because a custom property is valid in every browser.

### `@media`, `@import` and `@custom-media`

The lowered query is added to the list. A browser that does not understand `(min-height: 100dvh)` treats that one query as "never" and still honours the others, so the block is not duplicated:

```css
/* input */
@media (min-height: 100dvh) { … }
@import url("tall.css") (min-height: 100dvh);
@custom-media --tall (min-height: 100dvh);

/* output */
@media (min-height: 100vh), (min-height: 100dvh) { … }
@import url("tall.css") (min-height: 100vh), (min-height: 100dvh);
@custom-media --tall (min-height: 100vh), (min-height: 100dvh);
```

### `@container`

Lists of container conditions are not widely supported yet, so `@container` gets a twin rule in front of it:

```css
/* input */
@container card (width > 50dvw) { … }

/* output */
@container card (width > 50vw) { … }
@container card (width > 50dvw) { … }
```

### `@keyframes`

Plain values get a twin inside the keyframe. A value with `var()` cannot use one, and `@supports` cannot stand inside `@keyframes`, so the plugin lowers the value and repeats the whole `@keyframes` rule under `@supports`; the later rule of the same name wins wherever the units are supported. A chain of `customUnits` gets one such copy per step, the weakest first.

```css
/* input */
@keyframes grow {
  to {
    height: calc(100dvh - var(--gap));
  }
}

/* output */
@keyframes grow {
  to {
    height: calc(100vh - var(--gap));
  }
}
@supports (height: 1dvh) {
  @keyframes grow {
    to {
      height: calc(100dvh - var(--gap));
    }
  }
}
```

### `@property`

A browser accepts any `initial-value` when it parses the rule and drops the whole registration when it cannot read the value afterwards, so a twin would not help here either. The plugin lowers the value and repeats the rule under `@supports`; the later registration wins wherever the units are supported.

```css
/* input */
@property --sheet {
  syntax: '<length>';
  inherits: false;
  initial-value: 100dvh;
}

/* output */
@property --sheet {
  syntax: '<length>';
  inherits: false;
  initial-value: 100vh;
}
@supports (height: 1dvh) {
  @property --sheet {
    syntax: '<length>';
    inherits: false;
    initial-value: 100dvh;
  }
}
```

## What is left alone

- **`@supports` feature queries are never rewritten**, and what they guard gets no fallback. `@supports (height: 100dvh) { … }` already means "only where the unit works"; a probe for one built-in unit vouches for all of them. Conditions with `not`, `and` and `or` are read for what they guarantee: `(height: 1dvh) or (height: 1svh)` and `not (not (height: 1dvh))` guard the block, `(height: 1dvh) or (display: grid)` and `not (height: 1dvh)` do not.
- **Fallbacks you wrote yourself.** A declaration is not touched when its fallback is already in effect:

  ```css
  .a { height: 100vh; height: 100dvh; }
  .b { min-height: 100vh; min-height: -webkit-fill-available; min-height: 100dvh; }
  @media (min-height: 50vh), (min-height: 50dvh) { … }
  ```

  The fallback has to hold the same place in the cascade: between it and the modern declaration there may be comments, custom properties, declarations of unrelated properties and other values of the same property that you wrote. A shorthand or a longhand of the property in between could change it, so there the plugin adds its own twin:

  ```css
  /* input */
  .c {
    margin-top: 5vh;
    margin: 0;
    margin-top: 5dvh;
  }

  /* output */
  .c {
    margin-top: 5vh;
    margin: 0;
    margin-top: 5vh;
    margin-top: 5dvh;
  }
  ```

  With [`existingFallback: 'any'`](#existingfallback) any earlier value of the property counts, not only the exact `vh` equivalent.

- **Strings, `url()`, identifiers** such as `--dvh-color` or `x100dvh`, values and preludes that contain a CSS escape, and container style queries (`@container style(--h: 100dvh)`).
- **Descriptors** in `@font-face`, `@page` and similar rules always get a plain twin, also with `css-var`, because `var()` is invalid there. The `initial-value` of `@property` is [repeated under `@supports`](#property) instead.

## Strategies

### `duplicate` (default)

Everything described above: static fallbacks, nothing to ship, works everywhere. The fallback `vh` is the _largest_ viewport on mobile, the same thing `100vh` has always been.

### `css-var`

For legacy browsers that should follow the _live_ viewport. Every unit becomes a `calc()` over a CSS variable, and a small seed sets the variables:

<!-- prettier-ignore -->
```css
/* input */
.sheet { height: 100dvh; }

/* output */
:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.sheet { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }
```

On its own this behaves like `duplicate`. Its point is the **runtime**, which sets `--pvf-dvh` from the real window size in browsers without `dvh`:

```js
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';

applyViewportVars(); // does nothing in browsers that support dvh
```

The runtime has no dependencies (ESM: 3.1 KB raw, 1.1 KB gzip) and is written in ES5 syntax, so it parses in the browsers it exists for even when your bundler does not transpile `node_modules`. It returns `{ update, destroy }`, does nothing without a `window` (SSR), updates at most once per frame and measures again when a page comes back from the back/forward cache.

What it can and cannot reproduce:

- `dv*` follow the live layout viewport — as close to native as JavaScript gets
- `sv*` / `lv*` track the smallest / largest size seen so far in the current orientation, so they settle only after the browser chrome has collapsed or expanded once
- updates are frozen during pinch-zoom, which must not affect viewport units
- a height collapse of more than 30% at the same width while an input is focused is taken for the on-screen keyboard and ignored, as native `dv*` units do (a heuristic)

**The seed** goes at the top of each stylesheet that needs it, after `@charset` / `@import` / `@namespace` and a leading `/*! license */` comment, and lists only the units that were rewritten. It targets `:root, :host`, so the stylesheet also works inside a shadow root. With `postcss-html` every `<style>` block gets its own seed.

To ship the seed once instead — many entry points, CSS-in-JS, a component library — turn it off and import the ready-made file:

```js
viewportFallback({ strategy: 'css-var', seed: false });
```

```js
import 'postcss-viewport-fallback/seed.css'; // all 18 units, 0.2 KB gzip
```

> The `--pvf-` prefix is reserved: declarations whose name starts with `--pvf-` are never transformed, and the runtime writes only those variables.

`@media` / `@container` preludes and descriptors always use `duplicate`, because `var()` is invalid there.

## Options

```js
viewportFallback({
  strategy: 'duplicate', // or 'css-var'
  preserve: true, // false keeps only the fallback
  includeCustomProps: false,
  logicalFallback: 'physical', // or 'logical'
  existingFallback: 'exact', // or 'any'
  fragmentGuards: false,
  seed: true,
  onlyProperties: undefined, // string | RegExp | Array<string | RegExp>
  excludeProperties: undefined,
  customUnits: undefined, // e.g. { cqh: 'vh' }
  browserslist: false, // true | query | query[]
  fastSkip: false,
  strict: false,
  debug: false, // true | 'minimal' | 'verbose'
  onTransform(meta) {},
  onComplete(stats) {},
});
```

Options are checked when the plugin is created: an unknown name, a wrong type or an unknown value throws immediately.

### strategy

`'duplicate'` (default) or `'css-var'`. See [Strategies](#strategies).

### preserve

Keep the modern declaration next to the fallback (default: `true`). With `false` only the fallback remains — useful when a build targets old browsers only:

```css
/* height: 100dvh  →  */
height: 100vh;
/* @media (min-height: 100dvh)  →  */
@media (min-height: 100vh);
```

Blocks guarded by a matching `@supports` stay as they are: legacy browsers never apply them.

### includeCustomProps

Give custom properties a fallback too (default: `false`).

```css
/* input */
:root {
  --header-height: 100dvh;
  --sheet: 80svh;
}

/* output */
:root {
  --header-height: 100vh;
  --sheet: 80vh;
}
@supports (height: 1dvh) {
  :root {
    --header-height: 100dvh;
    --sheet: 80svh;
  }
}
```

In nested CSS the block follows the source order, as it does for [values with `var()`](#values-with-var-or-env):

```css
/* input */
:root {
  --h: 100dvh;
  @media (orientation: landscape) {
    --h: 60dvh;
  }
}

/* output */
:root {
  --h: 100vh;
  @supports (height: 1dvh) {
    --h: 100dvh;
  }
  @media (orientation: landscape) {
    --h: 60vh;
    @supports (height: 1dvh) {
      --h: 60dvh;
    }
  }
}
```

### logicalFallback

What `dvi` / `svi` / `lvi` and `dvb` / `svb` / `lvb` fall back to (default: `'physical'`).

- `'physical'` — `vw` and `vh`. Right for horizontal writing modes, and it works: a browser without `dvi` has no `vi` either, so a `vi` fallback would be dropped just the same.
- `'logical'` — `vi` and `vb`, as the specification pairs them. Choose it for pages in a vertical writing mode.

### existingFallback

What counts as a fallback you already wrote (default: `'exact'`).

- `'exact'` — an earlier declaration of the property with exactly the lowered value (`height: 100vh; height: 100dvh`)
- `'any'` — any earlier value of the property that old browsers accept (`height: 500px; height: 100dvh` is left alone)

Either way the earlier declaration has to hold the same place in the cascade, see [What is left alone](#what-is-left-alone).

### fragmentGuards

Treat top-level declarations as the body of a rule (default: `false`). Turn it on for styled-components, Emotion and other CSS-in-JS templates, so that values with `var()` and custom properties get their `@supports` block right there:

```css
/* input: the body of a styled.div`…` */
min-height: calc(100dvh - var(--header));
color: red;

/* output */
min-height: calc(100vh - var(--header));
@supports (height: 1dvh) {
  min-height: calc(100dvh - var(--header));
}
color: red;
```

It is off by default because a `style=""` attribute parsed without `postcss-html` looks the same, and an at-rule is invalid there.

### seed

Write the `--pvf-*` seed of `strategy: 'css-var'` into every stylesheet (default: `true`). With `false` you ship it once yourself, see [Strategies](#css-var).

### onlyProperties / excludeProperties

Limit the plugin to some properties, or keep it away from some. A string matches a property name exactly (custom properties case-sensitively), a RegExp tests the name; both accept an array.

```js
onlyProperties: ['height', /^(min|max)-height$/];
excludeProperties: [/^padding/, 'margin'];
```

At-rules take part under the names `@media`, `@container`, `@import` and `@custom-media`: `excludeProperties: ['@media']` keeps media queries as they are, and `onlyProperties: ['height']` turns at-rules off altogether.

### customUnits

Add your own unit → fallback pairs, or override a built-in one:

```js
customUnits: { cqh: 'vh', cqw: 'vw' }
```

A fallback is a unit name or `%`. Chains are allowed (`cqh → svh → vh` produces a fallback for every step). Two kinds of chains are rejected when the plugin is created: cycles, and chains that leave the built-in units and come back to them (`vmin: 'dvw'` would make `dvmin → vmin → dvw → vw`), because one `@supports` test stands for all built-in units. Custom units are assumed to be lengths: the `@supports` blocks probe them as `height: 1<unit>`, each with its own probe, and go from the weakest step of a chain to the strongest.

### browserslist

Stop handling the built-in units where every target browser supports them; `customUnits` keep working. Requires the optional peer dependency `caniuse-api`:

```bash
npm install caniuse-api --save-dev
```

```js
browserslist: true; // the browserslist config that applies to each file
browserslist: 'last 2 versions'; // or a query
browserslist: ['chrome >= 120', 'safari >= 17'];
```

With `true` the targets are resolved for the directory of every processed file, so packages of a monorepo can have different ones. If `caniuse-api` is not installed the plugin keeps transforming; an invalid query or a broken config throws.

### fastSkip

Skip a file whose source contains no viewport units after one regex scan (default: `false`). Do not turn it on when an earlier plugin brings units that are not in the source file — Tailwind utilities, `postcss-import`.

### strict

Throw, with the source position, wherever a fallback would be added or is needed but cannot be placed. A gate for CI when every viewport unit must be reviewed by hand. Declarations skipped by filters or control comments, guarded by `@supports`, or already covered by your own fallback do not trigger it.

### debug

`false` (default), `'minimal'` — a one-line summary, `true` / `'verbose'` — a line for every candidate and every transform plus the summary. Output goes through `result.warn()`, so it shows up in postcss-reporter and similar tools.

### onTransform(meta)

Called once for every declaration or at-rule that gets a fallback, with `{ prop, original, fallback, file, selector, loc }`. `selector` is the selector of the nearest enclosing style rule; for at-rules `prop` is `@media`, `@container`, `@import` or `@custom-media`.

### onComplete(stats)

Called once per processed file — once per document for HTML-like syntaxes:

```js
onComplete(stats) {
  stats.declarations; // fallback declarations added
  stats.atRules;      // at-rule fallbacks added
  stats.skipped;      // left alone: the fallback was already there
  stats.timeMs;       // processing time
}
```

### Message language

Errors and warnings are in English. Set the environment variable `PVF_LANG=ru` to get them in Russian.

## Control comments

Switch the plugin off for the next declaration or at-rule:

```css
.app {
  /* postcss-viewport-fallback: off */
  height: 100dvh; /* no fallback */
  width: 50dvw; /* gets one */
}
```

Or for a range. It applies to everything that follows inside the same block, including nested blocks:

```css
/* postcss-viewport-fallback: disable */
.hero {
  height: 100dvh;
}
@media (min-height: 50dvh) {
  .x {
    width: 10dvw;
  }
}
/* postcss-viewport-fallback: enable */
.app {
  height: 100dvh;
}
```

A range belongs to the block it is written in, and an `enable` inside a block overrides a `disable` around it. Spacing and letter case are flexible: `/*postcss-viewport-fallback:off*/` works too.

A declaration that is switched off stays as you wrote it everywhere: where the plugin has to repeat it inside an `@supports` block, to keep its place in the cascade, the copy gets an `off` comment of its own.

## Frameworks and tools

### Tailwind CSS

Tailwind [does not emit](https://github.com/tailwindlabs/tailwindcss/discussions/12752) `vh` fallbacks for `h-dvh`, `min-h-dvh`, `max-h-dvh` and arbitrary values such as `min-h-[calc(100dvh-var(--header))]`. List this plugin after Tailwind:

```js
// postcss.config.js — Tailwind v4
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-viewport-fallback': {},
  },
};
```

```js
// Tailwind v3
export default {
  plugins: {
    tailwindcss: {},
    'postcss-viewport-fallback': {},
  },
};
```

Leave `fastSkip` off for the Tailwind entry: the utilities are not in your source file.

### Vite

Vite reads `postcss.config.js` on its own. Inline configuration works as well:

```js
// vite.config.js
import viewportFallback from 'postcss-viewport-fallback';

export default {
  css: { postcss: { plugins: [viewportFallback()] } },
};
```

### Next.js

Next.js wants plugin names as strings, and a custom config replaces its default one:

```js
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-viewport-fallback': {},
  },
};
```

For `strategy: 'css-var'`, call `applyViewportVars()` from a client component in the root layout.

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  postcss: {
    plugins: {
      'postcss-viewport-fallback': {},
    },
  },
});
```

### Astro, SvelteKit, Vue

All three go through Vite: a `postcss.config.js` in the project root is enough, and `<style>` blocks of `.astro`, `.svelte` and `.vue` files are processed too.

### webpack

```js
// postcss-loader picks up postcss.config.js; or inline:
{ loader: 'postcss-loader', options: { postcssOptions: { plugins: ['postcss-viewport-fallback'] } } }
```

### Sass, Less, Stylus

Run the plugin on their output, as PostCSS plugins normally run. Top-level `$variables` of an SCSS file parsed with `postcss-scss` are fine.

### styled-components, Emotion

Parse the templates with a CSS-in-JS syntax and turn on [`fragmentGuards`](#fragmentguards):

```js
import postcssJsx from 'postcss-jsx';

export default {
  syntax: postcssJsx,
  plugins: [viewportFallback({ fragmentGuards: true })],
};
```

With `strategy: 'css-var'` a fragment has no place for the seed: use `seed: false` and import `postcss-viewport-fallback/seed.css` once.

### HTML

```js
import postcssHtml from 'postcss-html';

export default {
  syntax: postcssHtml,
  plugins: [viewportFallback()],
};
```

`<style>` blocks and `style=""` attributes are processed. An attribute cannot hold an `@supports` block, so a value with `var()` inside one is reported instead.

## Supported units

All small (`sv*`), large (`lv*`) and dynamic (`dv*`) viewport units of [CSS Values 4](https://www.w3.org/TR/css-values-4/#viewport-relative-units):

| Units               | Fallback                                    |
| ------------------- | ------------------------------------------- |
| dvw, svw, lvw       | vw                                          |
| dvh, svh, lvh       | vh                                          |
| dvmin, svmin, lvmin | vmin                                        |
| dvmax, svmax, lvmax | vmax                                        |
| dvi, svi, lvi       | vw (`vi` with `logicalFallback: 'logical'`) |
| dvb, svb, lvb       | vh (`vb` with `logicalFallback: 'logical'`) |

Unit names are matched in any letter case, as CSS does.

## Comparison

|                                                     | **postcss-viewport-fallback** | postcss-100vh-fix |                         postcss-viewport-unit-fallback                         | LightningCSS | postcss-preset-env |
| --------------------------------------------------- | :---------------------------: | :---------------: | :----------------------------------------------------------------------------: | :----------: | :----------------: |
| All 18 `sv*` / `lv*` / `dv*` units                  |              ✅               |  ❌ (100vh only)  |                              ⚠️ height units only                              |      ❌      |         ❌         |
| Width and logical units                             |              ✅               |        ❌         |                                       ❌                                       |      ❌      | ⚠️ `vi`/`vb` only  |
| Inside `calc()` / `min()` / `clamp()`               |              ✅               |        ❌         |                                       ❌                                       |      —       |         —          |
| Values with `var()` / `env()` that really fall back |              ✅               |        ❌         |                                       ❌                                       |      —       |         —          |
| Working fallbacks for custom properties             |              ✅               |        ❌         |                                       ❌                                       |      —       |         —          |
| `@media` / `@container` / `@import` preludes        |              ✅               |        ❌         |                                       ❌                                       |      —       |         —          |
| Preserves `!important`                              |              ✅               |        ✅         | ❌ ([bug](https://github.com/gooodev/postcss-viewport-unit-fallback/issues/1)) |      —       |         —          |
| Live values in legacy browsers                      |        ✅ (`css-var`)         |        ❌         |                                       ❌                                       |      ❌      |         ❌         |
| `browserslist` auto-skip                            |              ✅               |        ❌         |                                       ❌                                       | ✅ (targets) |     ✅ (stage)     |
| Actively maintained                                 |              ✅               |        ⚠️         |                                   ❌ (2023)                                    |      ✅      |         ✅         |

- **LightningCSS** does not lower viewport units and [won't](https://github.com/parcel-bundler/lightningcss/issues/534): its maintainer considers a static `dvw → vw` incorrect and a real polyfill dependent on JavaScript — which is what `strategy: 'css-var'` with the runtime provides.
- **Autoprefixer** adds vendor prefixes; units have none.
- **postcss-100vh-fix** solves the older iOS `-webkit-fill-available` problem. It is orthogonal, not a `dvh` fallback.

## Good to know about the units

- **`dvh` does not react to the on-screen keyboard.** Opt in with `<meta name="viewport" content="interactive-widget=resizes-content">` (Chromium only today).
- **`dvh` can jank.** Some browsers debounce dynamic viewport updates. For sticky or animated elements `svh` is often the calmer choice.
- **`svh` or `dvh`?** `svh` assumes the browser chrome is visible: content is never clipped. `dvh` follows the live viewport: it uses all the space, and it moves.
- **Safari 15.6 on macOS** renders `dvh` larger than expected ([WebKit #242758](https://bugs.webkit.org/show_bug.cgi?id=242758)).

## Known limitations

- **The lowered media query is not gated.** `(max-height: 100vh)` is evaluated by modern browsers too. For `min-*` queries it can only match where the original matches as well; for `max-*` and `<` comparisons there is a narrow band, between the dynamic and the large viewport size, where only the lowered query matches. The same holds for the `@container` twin.
- **Different custom units in one rule get a block each.** Built-in units share one `@supports` block. Values that need _different_ probes get a block each, in source order, and a declaration that can meet the values of several blocks is repeated in each of them. `@keyframes` and `@property` are repeated as a whole, so there such values are upgraded together: a browser that knows only some of the units keeps the fallback for all of them.
- **Values with CSS escapes are skipped.** A value or prelude that contains a backslash (`100d\76h`, `u\72l(…)`) is left untouched rather than guessed at. An at-rule whose _name_ is written with an escape (`@keyframe\73`) is not recognised at all: PostCSS ends the name at the backslash.
- **`style=""` attributes** have no place for an `@supports` block or a css-var seed. A value with `var()` in an attribute is reported instead of getting a fallback that cannot work. The seed for an attribute goes into the first `<style>` block of the document, and the plugin does not check that this block applies where the attribute does (a `media` attribute, a shadow root): if it does not, [ship the seed yourself](#seed).
- **Other plugins.** When another plugin of the pipeline visits nodes — `postcss-nesting`, `postcss-logical`, `postcss-preset-env`, a `px`-to-`rem` converter — this plugin does its work after all of them have finished, wherever it stands in the config. So it writes what it would write for the stylesheet those plugins leave, and the order of the two makes no difference: the test suite runs both orders against the real `postcss-logical` and `postcss-nesting`. Such plugins do not see the fallbacks. Plugins that work on the whole stylesheet at the end (Autoprefixer, minifiers) run in the order of the config: list a minifier after this plugin, or what it writes stays unminified.

## FAQ

**How do I add a fallback for `100dvh`?**
Install the plugin and add it to your PostCSS config. `height: 100dvh` becomes `height: 100vh; height: 100dvh`: old browsers use the first line, new ones the second.

**Does Tailwind CSS add a `vh` fallback for `h-dvh` or `min-h-dvh`?**
No. List this plugin after Tailwind and every `dvh` / `svh` / `lvh` utility, including arbitrary values, gets one.

**Why doesn't my hand-written fallback work for `calc(100dvh - var(--header))`?**
Because of `var()`. A browser cannot tell at parse time that the value is invalid, so it keeps the declaration, discards your fallback, and only later ends up with `auto`. The fallback has to be the value in the rule, with the modern one in `@supports` — which is what the plugin writes.

**Do I need a JavaScript polyfill?**
Not for a static fallback. If old browsers should follow the live viewport, as `dvh` does, use `strategy: 'css-var'` with the 1.1 KB runtime.

**Is `100vh` a good fallback for `100dvh`?**
It is the closest static value. On mobile, `100vh` is the viewport with the browser chrome hidden, so content can sit under the address bar — the behaviour old browsers have always had.

**Which browsers lack `dvh`, `svh` and `lvh`?**
Chrome and Edge before 108, Safari before 15.4, Firefox before 101, Samsung Internet before 21, Opera Mini, and the WebViews and TVs built on those engines.

**Does it work with Lightning CSS, postcss-preset-env or Autoprefixer?**
Yes. None of them lowers viewport units. Run this plugin after anything that writes units and before your minifier. Next to `postcss-preset-env` the order does not matter: the plugin waits for plugins that visit nodes and lowers what they leave.

**Does it change what modern browsers render?**
No. The plugin's tests include a randomized check that, for every selector and property, a browser that supports the units ends up with exactly the value you wrote.

## Migrating from 1.x

2.0 changes output where 1.x produced fallbacks that could not work. In short: pin 1.x if you depend on the old output, otherwise upgrade and review the diff of your built CSS once.

- **`@supports` is no longer rewritten.** 1.x added a `vh` twin of every `@supports (… dvh)` block, which un-gated the block and broke hand-written ladders. Declarations guarded by a matching `@supports` no longer get a twin either.
- **Values with `var()` / `env()` and custom properties** get the fallback in the rule and the original in an `@supports` block, instead of a twin that never applied. The `initial-value` of `@property` is handled the same way: the registration is repeated under `@supports`.
- **`@media` gets a longer query list instead of a second block.** `@container` keeps the twin rule. `@import` and `@custom-media` conditions are handled now.
- **One `@supports (height: 1dvh)` probe** stands for all built-in units. A `customUnits` chain that leaves the built-in units and returns to them is rejected.
- **Logical units fall back to `vw` / `vh`** instead of `vi` / `vb`. Set `logicalFallback: 'logical'` for the old mapping.
- **An existing fallback is recognised by its position**, not by its mere presence among the siblings.
- **The css-var seed** targets `:root, :host`, sits after `@import` / `@charset`, has one upgrade block for all built-in units, is not wrapped in control comments, and with `postcss-html` goes into every `<style>` block that needs it.
- **`replace` is gone:** use `preserve: false`. Unknown option names and invalid values throw.
- **`onTransform`'s `selector`** is the nearest enclosing rule's selector.
- **`require('postcss-viewport-fallback')` returns the plugin function**; `.default` still works.
- **`browserslist: true`** is resolved per file, and it keeps `customUnits` active.
- **Other plugins that visit nodes no longer see the fallbacks.** When there are such plugins in the pipeline, the plugin works after them. A minifier has to be listed after it.

## Development

```bash
npm test               # vitest suite
npm run test:coverage  # suite + v8 coverage report (thresholds: 100%)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format:check   # prettier
npm run build          # tsup → dist (esm + cjs + d.ts/d.cts + seed.css)
npm run check:package  # publint + arethetypeswrong + smoke test + consumer type fixtures
npm run bench          # quick benchmark on 20k generated rules
```

CI runs all of it on Node 20, 22 and 24 for every pull request. See [CONTRIBUTING.md](./CONTRIBUTING.md) for how the tests are organised, and [ROADMAP.md](./ROADMAP.md) for what may come next.

Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release): a push to `main` with [Conventional Commits](https://www.conventionalcommits.org) runs CI and, when a release is due, bumps the version, updates `CHANGELOG.md`, tags a GitHub release and publishes to npm with provenance.

## License

MIT License © 2025 Maksim Kravtsov
