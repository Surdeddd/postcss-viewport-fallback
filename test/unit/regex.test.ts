import { describe, it, expect } from 'vitest';
import { createDimensionRegex, createQuickTest } from '../../src/core/regex';

const units = ['dvh', 'dvw', 'dvmin', 'svh'];

function matches(value: string) {
  return [...value.matchAll(createDimensionRegex(units))].map((match) => match[0]);
}

describe('dimension matcher', () => {
  it.each([
    ['100dvh', ['100dvh']],
    ['-1.5dvh', ['-1.5dvh']],
    ['+.5e-3DVW', ['+.5e-3DVW']],
    ['10dvmin', ['10dvmin']],
    ['height>=100dvh', ['100dvh']],
    ['100dvh*2', ['100dvh']],
    ['2*100dvh', ['100dvh']],
    ['a+10dvh', ['10dvh']],
    ['10dvh,20svh', ['10dvh', '20svh']],
    ['[10dvh]', ['10dvh']],
    ['50%10dvh', ['10dvh']],
  ])('finds dimensions in %s', (value, expected) => {
    expect(matches(value)).toEqual(expected);
  });

  it.each([
    'dvh',
    'x100dvh',
    'a-100dvh',
    '--100dvh',
    '100dvh-x',
    '100dvhx',
    '100dvh1',
    '100dvh_',
    '#100dvh',
    '1-100dvh',
    'é100dvh',
    '100dvhé',
    '\\100dvh',
    '100dv',
    '100dvm',
  ])('ignores %s', (value) => {
    expect(matches(value)).toEqual([]);
  });

  it('matches whole unit names regardless of the order they are listed in', () => {
    for (const names of [
      ['dv', 'dvh', 'dvhx'],
      ['dvhx', 'dvh', 'dv'],
    ]) {
      const regex = createDimensionRegex(names);
      expect('1dvhx 2dvh 3dv'.match(regex)).toEqual(['1dvhx', '2dvh', '3dv']);
    }
  });

  it('never matches when there are no units', () => {
    expect('100dvh 1 2'.match(createDimensionRegex([]))).toBeNull();
    expect(createQuickTest([]).test('100dvh 1 2')).toBe(false);
  });

  it('stays linear on long digit runs', () => {
    const value = '1'.repeat(200_000) + 'x';
    const started = performance.now();
    expect(matches(value)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('quick test', () => {
  const quick = createQuickTest(units);

  it.each(['100dvh', 'calc(1px + 2DVW)', 'x1svh', '--a1dvh'])('passes %s', (value) => {
    expect(quick.test(value)).toBe(true);
  });

  it.each(['dvh', 'var(--dvh-color)', '100vh', 'svh 1', '1 dvh'])(
    'rejects %s',
    (value) => {
      expect(quick.test(value)).toBe(false);
    }
  );

  it('is stateless across calls', () => {
    expect(quick.test('1dvh')).toBe(true);
    expect(quick.test('1dvh')).toBe(true);
  });
});
