import { describe, it, expect } from 'vitest';
import plugin from '../src';
import type { ViewportFallbackOptions } from '../src';
import { run } from './helpers/run';

const invalid = (options: unknown) => () => plugin(options as ViewportFallbackOptions);

describe('option validation at plugin init', () => {
  it('rejects an unknown strategy instead of silently using duplicate', () => {
    expect(invalid({ strategy: 'cssvar' })).toThrow(/strategy/);
    expect(invalid({ strategy: 'cssvar' })).toThrow(/"duplicate"/);
  });

  it('rejects an unknown debug preset', () => {
    expect(invalid({ debug: 'loud' })).toThrow(/debug/);
  });

  it.each(['preserve', 'replace', 'includeCustomProps', 'strict', 'fastSkip'])(
    'rejects a non-boolean %s',
    (name) => {
      expect(invalid({ [name]: 'false' })).toThrow(new RegExp(name));
    }
  );

  it.each(['onTransform', 'onComplete'])('rejects a non-function %s', (name) => {
    expect(invalid({ [name]: 'log' })).toThrow(new RegExp(name));
  });

  it.each(['onlyProperties', 'excludeProperties'])(
    'rejects %s items that are neither strings nor RegExps',
    (name) => {
      expect(invalid({ [name]: [42] })).toThrow(new RegExp(name));
      expect(invalid({ [name]: { height: true } })).toThrow(new RegExp(name));
    }
  );

  it('rejects a browserslist value of the wrong type', () => {
    expect(invalid({ browserslist: 42 })).toThrow(/browserslist/);
    expect(invalid({ browserslist: ['chrome 130', 7] })).toThrow(/browserslist/);
  });

  it('rejects customUnits that is not a plain object', () => {
    expect(invalid({ customUnits: 'cqh' })).toThrow(/customUnits/);
    expect(invalid({ customUnits: ['cqh'] })).toThrow(/customUnits/);
  });

  it('validates customUnits even when browserslist disables the built-in units', () => {
    expect(invalid({ browserslist: 'chrome >= 130', customUnits: { '': 'vh' } })).toThrow(
      /invalid customUnits key/
    );
  });

  it('rejects a cycle through built-in units no matter what the targets support', () => {
    expect(invalid({ customUnits: { vh: 'dvh' } })).toThrow(/cycle/);
    expect(
      invalid({ browserslist: 'chrome >= 130', customUnits: { vh: 'dvh' } })
    ).toThrow(/cycle/);
  });

  it('rejects a non-object options argument', () => {
    expect(invalid('css-var')).toThrow(/options/);
    expect(invalid(42)).toThrow(/options/);
  });

  it('describes the received value without crashing on exotic input', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(invalid({ strategy: () => 'css-var' })).toThrow(/received function/);
    expect(invalid({ debug: /verbose/ })).toThrow('received /verbose/');
    expect(invalid({ strategy: circular })).toThrow(/strategy/);
    expect(invalid({ strategy: 10n })).toThrow(/strategy/);
    expect(invalid({ strict: Symbol('yes') })).toThrow(/strict/);
  });

  it('accepts null and undefined as "not set"', async () => {
    const out = await run(`.a { height: 100dvh; }`, {
      strategy: undefined,
      onlyProperties: null,
      excludeProperties: undefined,
      customUnits: null,
      debug: undefined,
      onTransform: undefined,
    } as unknown as ViewportFallbackOptions);
    expect(out).toBe(`.a { height: 100vh; height: 100dvh; }`);
    expect(() => plugin(null as unknown as ViewportFallbackOptions)).not.toThrow();
  });

  it('does not trip over object-prototype names used as fallback units', async () => {
    const out = await run(`.a { height: 1cqh; }`, {
      customUnits: { cqh: 'constructor' },
    });
    expect(out).toBe(`.a { height: 1constructor; height: 1cqh; }`);
  });

  it('does not treat object-prototype names as known units', async () => {
    const input = `.a { height: 1constructor; width: 2valueOf; }`;
    expect(await run(input, { customUnits: { cqh: 'vh' } })).toBe(input);
  });

  it('allows a custom unit named like an object-prototype key', async () => {
    const out = await run(`.a { height: 1constructor; }`, {
      customUnits: { constructor: 'vh' },
    });
    expect(out).toBe(`.a { height: 1vh; height: 1constructor; }`);
  });
});

describe('option names', () => {
  it('rejects a name the plugin does not know', () => {
    expect(() =>
      plugin({ includeCustomProp: true } as unknown as ViewportFallbackOptions)
    ).toThrow('[postcss-viewport-fallback] unknown option "includeCustomProp"');
  });

  it('says what replaced an option that was removed', () => {
    expect(() =>
      plugin({ replace: false } as unknown as ViewportFallbackOptions)
    ).toThrow(
      '[postcss-viewport-fallback] option "replace" was removed in 2.0: use preserve: false'
    );
  });

  it('accepts every documented option at once', () => {
    expect(() =>
      plugin({
        preserve: true,
        includeCustomProps: true,
        excludeProperties: 'width',
        onlyProperties: [/height/],
        strategy: 'css-var',
        logicalFallback: 'logical',
        existingFallback: 'any',
        fragmentGuards: true,
        debug: 'minimal',
        strict: false,
        customUnits: { cqh: 'vh' },
        browserslist: false,
        fastSkip: true,
        onTransform() {},
        onComplete() {},
      })
    ).not.toThrow();
  });
});
