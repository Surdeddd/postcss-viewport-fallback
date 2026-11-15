import type { TransformMeta } from './meta';
import type { TransformStats } from './stats';

export type PropertyFilter = (string | RegExp)[];
export type PropertyFilterInput = string | RegExp | PropertyFilter;

export interface ViewportFallbackOptions {
  /** Keep original modern declaration alongside the fallback (default: true) */
  preserve?: boolean;
  /**
   * Also give custom properties like `--header-height: 100dvh` a fallback (default: false).
   * A custom property is valid in every browser, so the fallback stays in the rule and
   * the original moves into an `@supports (height: 1dvh)` block right after it.
   */
  includeCustomProps?: boolean;

  /** Skip transformation for matching properties. String (exact), RegExp, or array of both. At-rules match as `@media`/`@container`. */
  excludeProperties?: PropertyFilterInput;
  /** Transform only matching properties. Same format as `excludeProperties`. */
  onlyProperties?: PropertyFilterInput;

  /**
   * How declaration fallbacks are produced (default: 'duplicate').
   * - 'duplicate' — insert a static `vh`/`vw`/... twin before the original
   * - 'css-var' — rewrite `100dvh` to `calc(var(--pvf-dvh, 1vh) * 100)` and inject
   *   a `:root, :host` seed upgraded via `@supports`; pair with `postcss-viewport-fallback/runtime`
   *   for live dv* values in legacy browsers (sv*\/lv* approximated). At-rule params
   *   and descriptors such as `@property { initial-value }` always use 'duplicate'
   *   because `var()` is invalid there.
   */
  strategy?: 'duplicate' | 'css-var';

  /**
   * Fallback for the logical units `dvi`/`svi`/`lvi` and `dvb`/`svb`/`lvb` (default: 'physical').
   * - 'physical' — `vw` and `vh`: right for horizontal writing modes, and it works, because
   *   a browser without `dvi` has no `vi` either
   * - 'logical' — `vi` and `vb`, as the specification pairs them
   */
  logicalFallback?: 'physical' | 'logical';

  /**
   * What counts as a fallback you already wrote (default: 'exact').
   * - 'exact' — an earlier declaration of the property with exactly the lowered value
   * - 'any' — any earlier value of the property that old browsers accept
   */
  existingFallback?: 'exact' | 'any';

  /**
   * Treat top-level declarations as the body of a rule (styled-components, Emotion): values
   * with `var()` and custom properties then get their `@supports` block right there (default: false).
   */
  fragmentGuards?: boolean;

  /**
   * Write the `--pvf-*` seed of `strategy: 'css-var'` into every stylesheet (default: true).
   * With `false` you ship it once yourself, for example `postcss-viewport-fallback/seed.css`.
   */
  seed?: boolean;

  /** Logging: false (default), 'minimal' (summary), true / 'verbose' (per-transform + summary). Emitted via `result.warn()`. */
  debug?: boolean | 'minimal' | 'verbose';
  /** Throw with source position wherever a fallback would be added or cannot be placed — CI gate (default: false) */
  strict?: boolean;

  /** Extra unit → fallback mappings, merged over built-ins (e.g. `{ cqh: 'vh' }`); a fallback is a unit name or `%`. Chains allowed, cycles rejected at init. */
  customUnits?: Record<string, string>;

  /**
   * Stop handling the built-in viewport units if all browser targets support them
   * (`customUnits` keep working). `true` resolves targets from the project browserslist
   * config; a string or array is used as the browserslist query directly. Requires
   * the optional peer dependency `caniuse-api`.
   */
  browserslist?: boolean | string | string[];

  /**
   * Skip files whose raw source contains no viewport units (single regex scan
   * instead of per-node visits). Do NOT enable when an earlier PostCSS plugin
   * brings viewport units into the same pipeline (e.g. Tailwind, postcss-import).
   */
  fastSkip?: boolean;

  /** Called for every transformation with `{ prop, original, fallback, file, selector, loc }` */
  onTransform?(meta: TransformMeta): void;
  /** Called once per processed file (once per document for HTML-like syntaxes) with `{ declarations, atRules, skipped, timeMs }` */
  onComplete?(stats: TransformStats): void;
}
