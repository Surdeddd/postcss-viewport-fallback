import valueParser from 'postcss-value-parser';
import { UNIT_MAP } from './units';
import { VIEWPORT_UNIT_REGEX } from './regex';

export function parseAndTransform(
  value: string,
  unitMap?: Record<string, string>,
  unitRegex?: RegExp,
): string | null {
  const map = unitMap ?? UNIT_MAP;
  const regex = unitRegex ?? VIEWPORT_UNIT_REGEX;
  let modified = false;

  const parsed = valueParser(value);

  parsed.walk((node) => {
    if (node.type !== 'word') return;

    const match = node.value.match(regex);
    if (!match) return;

    const [, number, unit] = match;
    if (map[unit]) {
      node.value = number + map[unit];
      modified = true;
    }
  });

  return modified ? parsed.toString() : null;
}
