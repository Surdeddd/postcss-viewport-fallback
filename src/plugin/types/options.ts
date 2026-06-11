import type { TransformMeta } from './meta';
import type { TransformStats } from './stats';

export type PropertyFilter = (string | RegExp)[];
export type PropertyFilterInput = string | RegExp | PropertyFilter;

export interface ViewportFallbackOptions {
  /** Keep original modern declaration alongside the fallback (default: true) */
  preserve?: boolean;
  /** @deprecated Use `preserve: false` instead. Remove original declaration. */
  replace?: boolean;
  includeCustomProps?: boolean;

  excludeProperties?: PropertyFilterInput;
  onlyProperties?: PropertyFilterInput;

  debug?: boolean | 'minimal' | 'verbose';
  strict?: boolean;

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

  onTransform?(meta: TransformMeta): void;
  onComplete?(stats: TransformStats): void;
}
