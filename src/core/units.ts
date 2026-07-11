export const UNIT_MAP: Record<string, string> = {
  dvw: 'vw',
  dvh: 'vh',
  dvi: 'vi',
  dvb: 'vb',
  dvmin: 'vmin',
  dvmax: 'vmax',
  svw: 'vw',
  svh: 'vh',
  svi: 'vi',
  svb: 'vb',
  svmin: 'vmin',
  svmax: 'vmax',
  lvw: 'vw',
  lvh: 'vh',
  lvi: 'vi',
  lvb: 'vb',
  lvmin: 'vmin',
  lvmax: 'vmax',
};

export type ViewportUnit = keyof typeof UNIT_MAP;

export function assertNoUnitCycles(unitMap: Record<string, string>): void {
  for (const start of Object.keys(unitMap)) {
    const seen = new Set<string>();
    let unit = start;
    while (unitMap[unit] !== undefined) {
      if (seen.has(unit)) {
        throw new Error(
          `[postcss-viewport-fallback] customUnits mapping cycle: ${[...seen, unit].join(' → ')}`,
        );
      }
      seen.add(unit);
      unit = unitMap[unit].toLowerCase();
    }
  }
}

const UNIT_NAME = /^[a-z]+$/i;
const FALLBACK_UNIT = /^[a-z%]+$/i;

export function validateCustomUnits(custom: Record<string, string>): void {
  for (const [unit, fallback] of Object.entries(custom)) {
    if (!UNIT_NAME.test(unit)) {
      throw new Error(
        `[postcss-viewport-fallback] invalid customUnits key ${JSON.stringify(unit)} — unit names must be non-empty and alphabetic (e.g. "cqh")`,
      );
    }
    if (typeof fallback !== 'string' || !FALLBACK_UNIT.test(fallback)) {
      throw new Error(
        `[postcss-viewport-fallback] invalid customUnits fallback for "${unit}": ${JSON.stringify(fallback)} — expected a CSS unit like "vh"`,
      );
    }
  }
}

export function mergeUnitMap(custom?: Record<string, string>): Record<string, string> {
  if (!custom || Object.keys(custom).length === 0) return UNIT_MAP;
  validateCustomUnits(custom);
  const normalized: Record<string, string> = {};
  for (const [unit, fallback] of Object.entries(custom)) {
    normalized[unit.toLowerCase()] = fallback;
  }
  return { ...UNIT_MAP, ...normalized };
}

/** Follow the fallback chain to units ordered by capability: [terminal, ..., unit]. */
export function resolveFallbackChain(unit: string, unitMap: Record<string, string>): string[] {
  const descending = [unit];
  let next = unitMap[unit];
  while (next !== undefined && descending.length <= Object.keys(unitMap).length) {
    descending.push(next.toLowerCase());
    next = unitMap[next.toLowerCase()];
  }
  return descending.reverse();
}
