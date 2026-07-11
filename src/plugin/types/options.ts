import type { TransformMeta } from './meta';
import type { TransformStats } from './stats';

export type PropertyFilter = (string | RegExp)[];
export type PropertyFilterInput = string | RegExp | PropertyFilter;

export interface ViewportFallbackOptions {
  /** Keep original modern declaration alongside the fallback (default: true) */
  preserve?: boolean;
  /** @deprecated Use `preserve: false` instead. Remove original declaration. */
  replace?: boolean;
  /** Also transform custom properties like `--header-height: 100dvh` (default: false) */
  includeCustomProps?: boolean;

  /** Skip transformation for matching properties. String (exact), RegExp, or array of both. At-rules match as `@media`/`@supports`/`@container`. */
  excludeProperties?: PropertyFilterInput;
  /** Transform only matching properties. Same format as `excludeProperties`. */
  onlyProperties?: PropertyFilterInput;

  /**
   * How declaration fallbacks are produced (default: 'duplicate').
   * - 'duplicate' — insert a static `vh`/`vw`/... twin before the original
   * - 'css-var' — rewrite `100dvh` to `calc(var(--pvf-dvh, 1vh) * 100)` and inject
   *   a `:root` seed upgraded via `@supports`; pair with `postcss-viewport-fallback/runtime`
   *   for live dv* values in legacy browsers (sv*\/lv* approximated). At-rule params
   *   always use 'duplicate' because `var()` is invalid there.
   */
  strategy?: 'duplicate' | 'css-var';

  /** Logging: false (default), 'minimal' (summary), true / 'verbose' (per-transform + summary). Emitted via `result.warn()`. */
  debug?: boolean | 'minimal' | 'verbose';
  /** Throw with source position wherever a transform would happen — CI gate (default: false) */
  strict?: boolean;

  /** Extra unit → fallback mappings, merged over built-ins (e.g. `{ cqh: 'vh' }`). Chains allowed, cycles rejected at init. */
  customUnits?: Record<string, string>;

  /**
   * Auto-skip the plugin if all browser targets support dynamic viewport units.
   * `true` resolves targets from the project browserslist config; a string or
   * array is used as the browserslist query directly. Requires `caniuse-api`.
   */
  browserslist?: boolean | string | string[];

  /**
   * Skip files whose raw source contains no viewport units (single regex scan
   * instead of per-node visits). Do NOT enable when an earlier PostCSS plugin
   * generates viewport units during the same pipeline (e.g. Tailwind).
   */
  fastSkip?: boolean;

  /** Called for every transformation with `{ prop, original, fallback, file, selector, loc }` */
  onTransform?(meta: TransformMeta): void;
  /** Called once per processed file with `{ declarations, atRules, skipped, timeMs }` */
  onComplete?(stats: TransformStats): void;
}
