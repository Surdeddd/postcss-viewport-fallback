import type { TransformMeta } from './meta';
import type { TransformStats } from './stats';

export type PropertyFilter = (string | RegExp)[];

export interface ViewportFallbackOptions {
  /** Keep original modern declaration alongside the fallback (default: true) */
  preserve?: boolean;
  /** @deprecated Use `preserve: false` instead. Remove original declaration. */
  replace?: boolean;
  includeCustomProps?: boolean;

  excludeProperties?: PropertyFilter;
  onlyProperties?: PropertyFilter;

  debug?: boolean | 'minimal' | 'verbose';
  strict?: boolean;

  customUnits?: Record<string, string>;

  /** Auto-skip if all browserslist targets support dvh/svh/lvh (requires browserslist) */
  browserslist?: boolean;

  onTransform?(meta: TransformMeta): void;
  onComplete?(stats: TransformStats): void;
}
