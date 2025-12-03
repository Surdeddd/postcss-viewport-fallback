# Roadmap

## Current Capabilities (built-in)

The plugin already supports the following features out of the box:

- Fallback transformation for `dvh`, `dvw`, `lvh`, `svh`, `dvi`, `dvb`
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
- Debug logging and `onTransform` callback
- Graceful parsing with full PostCSS AST traversal

These capabilities require no additional syntax plugins and work on pure CSS input.

---

## Planned Improvements

### Framework & Syntax Support

Add optional integrations for non-standard syntax environments:

- JSX inline style objects (`style={{ height: "100dvh" }}`)
- CSS-in-JS template literals beyond simple strings (styled-components, Emotion)
- Vue dynamic bindings (`:style="{ height: '100dvh' }"`)
- Svelte `style:prop` bindings
- Angular `[style.height]` and `ngStyle` expressions

### Inline Style Parsing

Introduce an internal lightweight inline-style parser to handle styles in HTML, Vue, Svelte, Angular without external syntax plugins.

### Optimization

- Remove duplicate fallback declarations
- Merge fallback and original declarations when identical
- Skip fallback generation when unnecessary
- Improve performance for large codebases

### Developer Experience

- Debug output presets
- Performance profiling tools

### Experimental Ideas

- Integration with LightningCSS or alternative CSS engines
- Strict mode that throws on unsupported viewport units

---
