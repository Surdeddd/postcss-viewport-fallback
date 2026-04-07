export const VIEWPORT_UNIT_REGEX = /(-?\d*\.?\d+)(dvh|dvw|lvh|svh|dvi|dvb)\b/;
export const QUICK_UNIT_TEST = /(dvh|dvw|lvh|svh|dvi|dvb)/;

export function createUnitRegex(units: string[]): RegExp {
  const sorted = [...units].sort((a, b) => b.length - a.length);
  const alternation = sorted.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(-?\\d*\\.?\\d+)(${alternation})\\b`);
}

export function createQuickTest(units: string[]): RegExp {
  const sorted = [...units].sort((a, b) => b.length - a.length);
  const alternation = sorted.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(${alternation})`);
}
