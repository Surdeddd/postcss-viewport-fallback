import { describe, it, expect } from 'vitest';
import { transformValue } from '../../src/core/parser';
import type { UnitTables } from '../../src/core/parser';
import { createDimensionRegex } from '../../src/core/regex';
import { createUnitMap, terminalUnits } from '../../src/core/units';

function tables(custom?: Record<string, string>): UnitTables {
  const unitMap = createUnitMap(custom, true);
  return {
    unitMap,
    terminals: terminalUnits(unitMap),
    dimension: createDimensionRegex(unitMap.keys()),
  };
}

describe('transformValue', () => {
  it('returns null when nothing is rewritten', () => {
    expect(transformValue('100vh "1dvh" url(1dvh)', tables(), 'duplicate')).toBeNull();
  });

  it('lists each unit once, lowercased, in order of first appearance', () => {
    const result = transformValue('1SVW 2dvh 3svw 4DvH', tables(), 'duplicate');
    expect(result).toEqual({ value: '1vw 2vh 3vw 4vh', units: ['svw', 'dvh'] });
  });

  it('lowers one chain step per call with the duplicate strategy', () => {
    const chain = tables({ cqh: 'svh' });
    expect(transformValue('1cqh', chain, 'duplicate')?.value).toBe('1svh');
    expect(transformValue('1svh', chain, 'duplicate')?.value).toBe('1vh');
  });

  it('uses the terminal unit as the var() fallback with css-var', () => {
    const chain = tables({ cqh: 'svh' });
    expect(transformValue('1cqh', chain, 'css-var')?.value).toBe(
      'calc(var(--pvf-cqh, 1vh) * 1)'
    );
  });

  it('does not let a shared global regex leak state between calls', () => {
    const shared = tables();
    for (let i = 0; i < 3; i++) {
      expect(transformValue('1dvh 2dvh', shared, 'duplicate')?.value).toBe('1vh 2vh');
    }
  });

  it.each([
    ['calc(100dvh + )', 'calc(100vh + )'],
    ['calc(100dvh', 'calc(100vh'],
    ['100dvh)', '100vh)'],
    ['"unterminated 1dvh', null],
    ['', null],
  ])('copes with malformed input %j', (value, expected) => {
    expect(transformValue(value, tables(), 'duplicate')?.value ?? null).toBe(expected);
  });
});
