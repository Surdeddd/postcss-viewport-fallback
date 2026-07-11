import type { PropertyFilter } from '../plugin/types';

/**
 * Check if a property matches any item in a filter.
 * Strings compare case-insensitively for regular CSS properties and exactly
 * for custom properties (which are case-sensitive per spec). RegExps test the
 * original property name.
 */
export function matchesFilter(prop: string, filter: PropertyFilter): boolean {
  const isCustom = prop.startsWith('--');
  const lowered = isCustom ? prop : prop.toLowerCase();
  return filter.some((pattern) => {
    if (typeof pattern === 'string') {
      if (isCustom || pattern.startsWith('--')) return pattern === prop;
      return pattern.toLowerCase() === lowered;
    }
    return pattern.test(prop);
  });
}
