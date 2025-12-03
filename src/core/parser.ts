import valueParser from 'postcss-value-parser';
import { UNIT_MAP } from './units.js';
import { VIEWPORT_UNIT_REGEX } from './regex.js';

export function parseAndTransform(value: string): string | null {
  let modified = false;

  const parsed = valueParser(value);

  parsed.walk(node => {
    if (node.type !== 'word') return;

    const match = node.value.match(VIEWPORT_UNIT_REGEX);
    if (!match) return;

    const [, number, unit] = match;
    node.value = number + UNIT_MAP[unit as keyof typeof UNIT_MAP];
    modified = true;
  });

  return modified ? parsed.toString() : null;
}
