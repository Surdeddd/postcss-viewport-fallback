# Roadmap

## Current Capabilities (built-in)

The plugin already supports the following features out of the box:

- Fallback transformation for `dvh`, `dvw`, `lvh`, `svh`, `dvi`, `dvb`
- Custom unit mapping via `customUnits` option
- Works inside functions: `calc()`, `min()`, `max()`, `clamp()`
- Handles nested function structures
- Supports fallback generation inside:
  - `@media`
  - `@supports`
  - `@container`
- Correct handling of edge cases:
  - Strings
  - `url()`
  - Invalid or malformed values
- Property allowlist (`onlyProperties`) and denylist (`excludeProperties`)
- Debug presets (`'minimal'`, `'verbose'`, `boolean`)
- `onTransform` callback for every transformation
- `onComplete` callback with stats (`declarations`, `atRules`, `skipped`, `timeMs`)
- `strict` mode that throws on viewport units (for CI)
- Dedup optimization (skips if fallback already exists)
- Single-pass AST traversal for performance
- Graceful parsing with full PostCSS AST traversal

These capabilities require no additional syntax plugins and work on pure CSS input.

---

## Planned Improvements

### Framework & Syntax Support

Add optional integrations for non-standard syntax environments:

- JSX inline style objects (`style={{ height: "100dvh" }}`) — requires Babel plugin, out of PostCSS scope
- Svelte `style:prop` bindings
- Angular `[style.height]` and `ngStyle` expressions

### Inline Style Parsing

Introduce an internal lightweight inline-style parser to handle styles in HTML, Vue, Svelte, Angular without external syntax plugins.

### Experimental Ideas

- Integration with LightningCSS or alternative CSS engines (note: LightningCSS handles viewport fallbacks natively)

---
