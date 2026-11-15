import { describe, it, expect } from 'vitest';
import { createUnitMap, fallbackChain, terminalUnits } from '../../src/core/units';

describe('unit map', () => {
  it('contains the 18 built-in viewport units', () => {
    const units = createUnitMap(undefined, true);
    expect(units.size).toBe(18);
    expect(units.get('dvh')).toBe('vh');
    expect(units.get('svmin')).toBe('vmin');
    expect(units.get('lvb')).toBe('vb');
  });

  it('is empty without built-ins and custom units', () => {
    expect(createUnitMap(undefined, false).size).toBe(0);
    expect(createUnitMap({}, false).size).toBe(0);
  });

  it('lowercases custom keys and keeps fallback casing', () => {
    const units = createUnitMap({ CQH: 'VH' }, false);
    expect([...units]).toEqual([['cqh', 'VH']]);
  });

  it('lets custom units override built-ins', () => {
    expect(createUnitMap({ dvh: 'svh' }, true).get('dvh')).toBe('svh');
  });

  it('reports the full cycle path', () => {
    expect(() => createUnitMap({ a: 'b', b: 'c', c: 'a' }, false)).toThrow(
      'a → b → c → a'
    );
  });

  it('detects cycles through differently cased fallbacks', () => {
    expect(() => createUnitMap({ dvh: 'SVH', svh: 'DVH' }, true)).toThrow(/cycle/);
  });

  it('rejects a missing fallback value', () => {
    expect(() =>
      createUnitMap({ cqh: undefined } as unknown as Record<string, string>, false)
    ).toThrow(/invalid customUnits fallback for "cqh": undefined/);
  });

  it('allows % as a fallback unit', () => {
    expect(createUnitMap({ cqh: '%' }, false).get('cqh')).toBe('%');
  });
});

describe('fallback chains', () => {
  const units = createUnitMap({ cqmax: 'cqh', cqh: 'SVH' }, true);

  it('orders a chain from terminal to the unit itself', () => {
    expect(fallbackChain('cqmax', units)).toEqual(['vh', 'SVH', 'cqh', 'cqmax']);
    expect(fallbackChain('dvw', units)).toEqual(['vw', 'dvw']);
  });

  it('maps every unit to its terminal fallback', () => {
    const terminals = terminalUnits(units);
    expect(terminals.get('cqmax')).toBe('vh');
    expect(terminals.get('cqh')).toBe('vh');
    expect(terminals.get('dvmax')).toBe('vmax');
    expect(terminals.size).toBe(units.size);
  });
});
