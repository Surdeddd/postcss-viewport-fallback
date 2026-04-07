export const UNIT_MAP: Record<string, string> = {
  dvh: 'vh',
  dvw: 'vw',
  lvh: 'vh',
  svh: 'vh',
  dvi: 'vi',
  dvb: 'vb',
};

export type ViewportUnit = keyof typeof UNIT_MAP;

export function mergeUnitMap(custom?: Record<string, string>): Record<string, string> {
  if (!custom || Object.keys(custom).length === 0) return UNIT_MAP;
  return { ...UNIT_MAP, ...custom };
}
