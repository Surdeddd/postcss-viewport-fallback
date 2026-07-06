# [1.6.0](https://github.com/Surdeddd/postcss-viewport-fallback/compare/v1.5.0...v1.6.0) (2026-07-06)


### Features

* pixel-perfect css-var strategy + browser runtime, toolchain majors ([8712db3](https://github.com/Surdeddd/postcss-viewport-fallback/commit/8712db3b59e857cd2cd793aea89960d66016d00e))

# [1.5.0](https://github.com/Surdeddd/postcss-viewport-fallback/compare/v1.4.0...v1.5.0) (2026-06-11)


### Features

* v1.5.0 — full unit set, fastSkip, comment ranges, browserslist queries ([a2b14cc](https://github.com/Surdeddd/postcss-viewport-fallback/commit/a2b14cc54e6a15c8aaef87f777f8ba5d2771562a))

# Changelog

> Starting with 1.5.0 this file is generated automatically by [semantic-release](https://github.com/semantic-release/semantic-release) from conventional commit messages.

## 1.0.0 (2025)

### Features

- Fallback transformation for `dvh`, `dvw`, `lvh`, `svh`, `dvi`, `dvb`
- Works inside `calc()`, `min()`, `max()`, `clamp()` and nested functions
- `@media`, `@supports`, `@container` at-rule support
- Property allowlist (`onlyProperties`) and denylist (`excludeProperties`)
- `replace` mode to substitute instead of duplicate
- `includeCustomProps` for CSS custom properties
- `debug` logging and `onTransform` callback
- Safe parsing via `postcss-value-parser`

## 1.4.0 (2026-04-03)

### Features

- `preserve` option (default: `true`) — set to `false` to remove original modern declarations, keeping only fallbacks. `replace` kept as deprecated alias.
- `browserslist` option — auto-skip plugin when all target browsers support dynamic viewport units (requires optional `caniuse-api`)
- Regex property filtering — `onlyProperties` and `excludeProperties` now accept `string | RegExp | Array<string | RegExp>`
- Control comments now work for `@media`, `@supports`, `@container` at-rules (not just declarations)

### Architecture

- Merged 3 at-rule processors into shared `processAtRule()` utility (~70 lines removed)
- Centralized `DISABLE_COMMENT` constant
- Fixed `onTransform` `selector` field — now returns selector string instead of full CSS block
- Cleaned up `.js` import extensions inconsistency
- README badges (npm version, downloads, CI, license, node)

## 1.3.0 (2026-03-27)

### Refactoring

- Refactored to PostCSS 8 Listener API (`Declaration()`, `AtRule.media()`, `OnceExit()`) for better performance with multi-plugin pipelines
- Replaced all `console.log` with PostCSS `result.warn()` per official plugin guidelines
- Extracted shared dedup logic into `src/core/dedup.ts` utility
- Internal types (`_unitMap`, `_unitRegex`, `_quickTest`) removed from public API — now in private `ResolvedConfig`

### Features

- **Control comments** — `/* postcss-viewport-fallback: off */` disables transformation for the next declaration
- Fixed `package.json` exports with proper `types` condition for `moduleResolution: "bundler"`

### Testing

- Added tests: control comments, strict mode edge cases, replace + dedup, empty CSS, customUnits + excludeProperties, @keyframes in @media
- Removed unused `test/helpers/htmlProcessor.ts`
- 86 tests total

## 1.2.0 (2026-03-27)

### Features

- `customUnits` option — define custom unit-to-fallback mappings (e.g., `{ cqh: 'vh' }`)
- `debug` presets — `'minimal'` (summary only), `'verbose'` (full logs + summary), `boolean`
- `onComplete(stats)` callback — receive `{ declarations, atRules, skipped, timeMs }` after processing
- Built-in performance profiling via `stats.timeMs`

## 1.1.0 (2026-03-27)

### Features

- `strict` mode — throws with source position when dynamic viewport units are found (useful for CI)
- `onTransform` callback now fires for `@media`, `@supports`, `@container` transformations
- Standardized debug logging across all processors

### Performance

- Single AST traversal pass instead of 4 separate walks
- Dedup optimization — skips fallback generation if identical fallback already exists

### Infrastructure

- Added `repository`, `bugs`, `homepage`, `keywords` to package.json
- Added GitHub Actions CI (test on Node 20/22) and npm publish workflow
- Added `.nvmrc`
- Added framework usage documentation to README
