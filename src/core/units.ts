export const UNIT_MAP = {
  dvh: 'vh',
  dvw: 'vw',
  lvh: 'vh',
  svh: 'vh',
  dvi: 'vi',
  dvb: 'vb',
} as const;

export type ViewportUnit = keyof typeof UNIT_MAP;
