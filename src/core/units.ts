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

export function mergeUnitMap(custom?: Record<string, string>): Record<string, string> {
  if (!custom || Object.keys(custom).length === 0) return UNIT_MAP;
  const normalized: Record<string, string> = {};
  for (const [unit, fallback] of Object.entries(custom)) {
    normalized[unit.toLowerCase()] = fallback;
  }
  return { ...UNIT_MAP, ...normalized };
}
