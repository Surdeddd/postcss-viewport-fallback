import { parseAndTransform } from './parser';
import type { FallbackStrategy } from './parser';
import { matchesFilter } from './propertyFilter';
import type { PropertyFilter } from '../plugin/types';

export interface TransformContext {
  strategy: FallbackStrategy;
  onUnitUsed?: ((unit: string, fallbackUnit: string) => void) | undefined;
}

export function transformValue(
  value: string,
  prop: string,
  opts: {
    excludeProperties?: PropertyFilter | undefined;
    onlyProperties?: PropertyFilter | undefined;
    unitMap?: Record<string, string>;
    unitRegex?: RegExp;
  },
  ctx?: TransformContext,
): string | null {
  if (opts.excludeProperties && matchesFilter(prop, opts.excludeProperties)) return null;

  if (opts.onlyProperties && !matchesFilter(prop, opts.onlyProperties)) return null;

  return parseAndTransform(
    value,
    opts.unitMap,
    opts.unitRegex,
    ctx?.strategy ?? 'duplicate',
    ctx?.onUnitUsed,
  );
}
