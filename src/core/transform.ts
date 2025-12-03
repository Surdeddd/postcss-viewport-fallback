import { parseAndTransform } from './parser';

export function transformValue(
  value: string,
  prop: string,
  opts: { excludeProperties?: string[]; onlyProperties?: string[] }
): string | null {
  if (opts.excludeProperties?.includes(prop)) return null;

  if (opts.onlyProperties && !opts.onlyProperties.includes(prop)) return null;

  return parseAndTransform(value);
}
