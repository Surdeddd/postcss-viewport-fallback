import { parseAndTransform } from './parser';
import { matchesFilter } from './propertyFilter';
import type { PropertyFilter } from '../plugin/types';

export function transformValue(
  value: string,
  prop: string,
  opts: {
    excludeProperties?: PropertyFilter;
    onlyProperties?: PropertyFilter;
    unitMap?: Record<string, string>;
    unitRegex?: RegExp;
  },
): string | null {
  if (opts.excludeProperties && matchesFilter(prop, opts.excludeProperties)) return null;

  if (opts.onlyProperties && !matchesFilter(prop, opts.onlyProperties)) return null;

  return parseAndTransform(value, opts.unitMap, opts.unitRegex);
}
