import type { PropertyFilter } from '../plugin/types';

export type PropertyMatcher = (prop: string) => boolean;

function stateless(pattern: RegExp): RegExp {
  return /[gy]/.test(pattern.flags)
    ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
    : pattern;
}

/** Strings match case-insensitively (custom properties exactly); RegExps test as written. */
export function createPropertyMatcher(patterns: PropertyFilter): PropertyMatcher {
  const customNames = new Set<string>();
  const regularNames = new Set<string>();
  const regexes: RegExp[] = [];

  for (const pattern of patterns) {
    if (typeof pattern !== 'string') regexes.push(stateless(pattern));
    else if (pattern.startsWith('--')) customNames.add(pattern);
    else regularNames.add(pattern.toLowerCase());
  }

  return (prop) =>
    (prop.startsWith('--')
      ? customNames.has(prop)
      : regularNames.has(prop.toLowerCase())) ||
    regexes.some((regex) => regex.test(prop));
}

/** Combined allowlist/denylist check; undefined filters impose no restriction. */
export function createPropertyGate(
  only: PropertyFilter | undefined,
  exclude: PropertyFilter | undefined
): PropertyMatcher {
  const included = only && createPropertyMatcher(only);
  const excluded = exclude && createPropertyMatcher(exclude);
  if (!included && !excluded) return () => true;
  return (prop) => !(excluded && excluded(prop)) && (!included || included(prop));
}
