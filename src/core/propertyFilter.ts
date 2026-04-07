import type { PropertyFilter } from '../plugin/types';

/** Check if a property matches any item in a filter (string exact match or RegExp test). */
export function matchesFilter(prop: string, filter: PropertyFilter): boolean {
  return filter.some((pattern) =>
    typeof pattern === 'string' ? pattern === prop : pattern.test(prop),
  );
}
