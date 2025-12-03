import type { TransformMeta } from './meta';

export interface ViewportFallbackOptions {
  replace?: boolean;
  includeCustomProps?: boolean;

  excludeProperties?: string[];
  onlyProperties?: string[];

  debug?: boolean;

  onTransform?(meta: TransformMeta): void;
}
