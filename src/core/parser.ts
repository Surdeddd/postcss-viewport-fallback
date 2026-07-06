import valueParser from 'postcss-value-parser';
import { UNIT_MAP } from './units';
import { VIEWPORT_UNIT_REGEX } from './regex';
import { CSS_VAR_PREFIX } from './constants';

export type FallbackStrategy = 'duplicate' | 'css-var';

export function parseAndTransform(
  value: string,
  unitMap?: Record<string, string>,
  unitRegex?: RegExp,
  strategy: FallbackStrategy = 'duplicate',
  onUnitUsed?: (unit: string, fallbackUnit: string) => void,
): string | null {
  const map = unitMap ?? UNIT_MAP;
  const regex = unitRegex ?? VIEWPORT_UNIT_REGEX;
  let modified = false;

  const parsed = valueParser(value);

  parsed.walk((node) => {
    if (node.type !== 'word') return;

    const match = node.value.match(regex);
    if (!match) return;

    const [, number, rawUnit] = match;
    const unit = rawUnit.toLowerCase();
    const fallbackUnit = map[unit];
    if (!fallbackUnit) return;

    node.value =
      strategy === 'css-var'
        ? `calc(var(${CSS_VAR_PREFIX}${unit}, 1${fallbackUnit}) * ${number})`
        : number + fallbackUnit;
    onUnitUsed?.(unit, fallbackUnit);
    modified = true;
  });

  return modified ? parsed.toString() : null;
}
