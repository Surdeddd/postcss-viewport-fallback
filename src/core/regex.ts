import { UNIT_MAP } from './units';

const NUMBER_PATTERN = '[-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?';

export function createUnitRegex(units: string[]): RegExp {
  const sorted = [...units].sort((a, b) => b.length - a.length);
  const alternation = sorted.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`^(${NUMBER_PATTERN})(${alternation})$`, 'i');
}

export function createQuickTest(units: string[]): RegExp {
  const sorted = [...units].sort((a, b) => b.length - a.length);
  const alternation = sorted.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(${alternation})`, 'i');
}

export const VIEWPORT_UNIT_REGEX = createUnitRegex(Object.keys(UNIT_MAP));
export const QUICK_UNIT_TEST = createQuickTest(Object.keys(UNIT_MAP));
