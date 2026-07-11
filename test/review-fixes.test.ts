import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string, opts = {}) {
  const result = await postcss([plugin(opts)]).process(input, { from: undefined });
  return result.css;
}

describe('property filters: RegExp flags g/y', () => {
  it('global-flag filter matches consistently across many declarations', async () => {
    const out = await run(
      `.a { height: 100dvh; } .b { height: 50dvh; } .c { height: 25dvh; }`,
      { onlyProperties: /height/g },
    );
    expect(out).toContain('height: 100vh');
    expect(out).toContain('height: 50vh');
    expect(out).toContain('height: 25vh');
  });

  it('sticky-flag filter matches consistently', async () => {
    const out = await run(`.a { height: 100dvh; width: 100dvw; height: 50dvh; }`, {
      excludeProperties: /^height$/y,
    });
    expect(out).not.toContain('height: 100vh');
    expect(out).not.toContain('height: 50vh');
    expect(out).toContain('width: 100vw');
  });

  it('does not mutate the lastIndex of the user-supplied RegExp', async () => {
    const pattern = /height/g;
    await run(`.a { height: 100dvh; }`, { onlyProperties: pattern });
    expect(pattern.lastIndex).toBe(0);
  });
});

describe('property filters: case sensitivity', () => {
  it('string filters match CSS properties case-insensitively', async () => {
    for (const prop of ['HEIGHT', 'Height', 'height']) {
      const out = await run(`.a { ${prop}: 100dvh; }`, { onlyProperties: 'height' });
      expect(out, prop).toContain(`${prop}: 100vh`);
    }
  });

  it('uppercase string filter matches lowercase property', async () => {
    const out = await run(`.a { height: 100dvh; }`, { excludeProperties: 'HEIGHT' });
    expect(out).not.toContain('100vh');
  });

  it('custom properties stay case-sensitive', async () => {
    const match = await run(`.a { --Sheet: 100dvh; }`, {
      includeCustomProps: true,
      excludeProperties: '--Sheet',
    });
    expect(match).not.toContain('100vh');

    const noMatch = await run(`.a { --Sheet: 100dvh; }`, {
      includeCustomProps: true,
      excludeProperties: '--sheet',
    });
    expect(noMatch).toContain('100vh');
  });
});

describe('customUnits validation', () => {
  it('rejects an empty key instead of matching every number', () => {
    expect(() => plugin({ customUnits: { '': 'vh' } })).toThrow(/invalid customUnits key/);
  });

  it('rejects non-alphabetic keys', () => {
    expect(() => plugin({ customUnits: { '1x)': 'vh' } })).toThrow(/invalid customUnits key/);
  });

  it('rejects empty and non-unit fallback values', () => {
    expect(() => plugin({ customUnits: { cqh: '' } })).toThrow(/invalid customUnits fallback/);
    expect(() =>
      plugin({ customUnits: { cqh: 12 as unknown as string } }),
    ).toThrow(/invalid customUnits fallback/);
  });

  it('still allows uppercase keys, overrides, chains; still rejects cycles', async () => {
    const out = await run(`.a { height: 100cqh; }`, { customUnits: { CQH: 'vh' } });
    expect(out).toContain('height: 100vh');

    const override = await run(`.a { height: 100dvh; }`, { customUnits: { dvh: 'svh' } });
    expect(override).toContain('height: 100svh');

    expect(() => plugin({ customUnits: { dvh: 'svh', svh: 'dvh' } })).toThrow(/cycle/);
  });

  it('never touches unitless values like opacity: 1', async () => {
    const out = await run(`.a { opacity: 1; }`, { customUnits: { cqh: 'vh' } });
    expect(out).toBe(`.a { opacity: 1; }`);
  });
});

describe('case-insensitive at-rules', () => {
  it('@MEDIA is idempotent across runs and keeps original casing', async () => {
    const input = `@MEDIA (min-height: 100dvh) { .a { color: red; } }`;
    const first = await run(input);
    expect(first).toContain('@MEDIA (min-height: 100vh)');
    expect((first.match(/@MEDIA/g) ?? []).length).toBe(2);

    const second = await run(first);
    expect(second).toBe(first);
  });

  it('@SUPPORTS and @CONTAINER dedup case-insensitively', async () => {
    const supports = `@SUPPORTS (height: 100vh) {} @SUPPORTS (height: 100dvh) {}`;
    expect(await run(supports)).toBe(supports);

    const container = `@Container (min-height: 50vh) {} @Container (min-height: 50dvh) {}`;
    expect(await run(container)).toBe(container);
  });

  it('preserve: false removes the uppercase original', async () => {
    const out = await run(`@MEDIA (min-height: 100dvh) { .a { color: red; } }`, {
      preserve: false,
    });
    expect(out).toContain('@MEDIA (min-height: 100vh)');
    expect(out).not.toContain('100dvh');
  });

  it('nested uppercase at-rules stay idempotent', async () => {
    const input = `.card { @MEDIA (min-height: 50dvh) { width: 10dvw; } }`;
    const first = await run(input);
    const second = await run(first);
    expect(second).toBe(first);
  });
});

describe('browserslist config errors are loud', () => {
  it('throws on an invalid browserslist query instead of silently ignoring it', () => {
    expect(() => plugin({ browserslist: 'definitely !!! not a query' })).toThrow(
      /invalid browserslist configuration/,
    );
  });

  it('boolean true with no config still works quietly', async () => {
    const out = await run(`.a { height: 100dvh; }`, { browserslist: true });
    expect(out).toContain('100vh');
  });
});

describe('duplicate strategy chains remain progressive', () => {
  it('cqh -> svh -> vh emits the progressive ladder', async () => {
    const out = await run(`.a { height: 100cqh; }`, { customUnits: { cqh: 'svh' } });
    const idx = (s: string) => out.indexOf(s);
    expect(idx('height: 100vh')).toBeGreaterThanOrEqual(0);
    expect(idx('height: 100svh')).toBeGreaterThan(idx('height: 100vh'));
    expect(idx('height: 100cqh')).toBeGreaterThan(idx('height: 100svh'));
  });
});
