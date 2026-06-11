import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';
import type { TransformStats } from '../src';

async function run(input: string, opts = {}) {
  const result = await postcss([plugin(opts)]).process(input, { from: undefined });
  return result.css;
}

describe('value corruption (anchored unit regex)', () => {
  it('does not mangle idents containing a unit substring', async () => {
    const input = `.a { animation-timeline: --scroll-100dvh-timeline; }`;
    const out = await run(input);
    expect(out).toBe(input);
  });

  it('does not transform invalid dimensions with a prefix', async () => {
    const input = `.a { height: x100dvh; }`;
    const out = await run(input);
    expect(out).toBe(input);
  });

  it('transforms scientific notation numbers', async () => {
    const out = await run(`.a { height: 1e2dvh; }`);
    expect(out).toContain('height: 1e2vh');
    expect(out).toContain('height: 1e2dvh');
  });

  it('transforms explicit plus-signed numbers', async () => {
    const out = await run(`.a { height: calc(50px + +10dvh); }`);
    expect(out).toContain('calc(50px + +10vh)');
  });
});

describe('strict mode scoping', () => {
  it('does not throw on var() names containing a unit substring', async () => {
    const out = await run(`.a { color: var(--dvh-color); }`, { strict: true });
    expect(out).toContain('var(--dvh-color)');
  });

  it('respects excludeProperties', async () => {
    const out = await run(`.a { height: 100dvh; }`, {
      strict: true,
      excludeProperties: ['height'],
    });
    expect(out).toContain('height: 100dvh');
  });

  it('respects onlyProperties', async () => {
    const out = await run(`.a { width: 100dvw; }`, {
      strict: true,
      onlyProperties: ['height'],
    });
    expect(out).toContain('width: 100dvw');
  });

  it('skips custom properties unless includeCustomProps', async () => {
    const out = await run(`.a { --h: 100dvh; }`, { strict: true });
    expect(out).toContain('--h: 100dvh');

    await expect(
      postcss([plugin({ strict: true, includeCustomProps: true })]).process(
        `.a { --h: 100dvh; }`,
        { from: undefined },
      ),
    ).rejects.toThrow('Dynamic viewport unit found');
  });

  it('throws on at-rules with viewport units', async () => {
    await expect(
      postcss([plugin({ strict: true })]).process(
        `@media (min-height: 100dvh) { .a { color: red; } }`,
        { from: undefined },
      ),
    ).rejects.toThrow('Dynamic viewport unit found: @media');
  });
});

describe('full viewport unit set', () => {
  it('covers small/large width and inline/block variants', async () => {
    const out = await run(
      `.a { width: 100svw; height: 50lvw; inline-size: 10svi; block-size: 20lvb; }`,
    );
    expect(out).toContain('width: 100vw');
    expect(out).toContain('height: 50vw');
    expect(out).toContain('inline-size: 10vi');
    expect(out).toContain('block-size: 20vb');
  });

  it('covers min/max variants', async () => {
    const out = await run(`.a { margin: 1dvmin 2dvmax 3svmin 4lvmax; }`);
    expect(out).toContain('margin: 1vmin 2vmax 3vmin 4vmax');
    expect(out).toContain('margin: 1dvmin 2dvmax 3svmin 4lvmax');
  });
});

describe('case-insensitive units', () => {
  it('transforms uppercase and mixed-case units', async () => {
    const out = await run(`.a { height: 100DVH; width: calc(50dVw - 10px); }`);
    expect(out).toContain('height: 100vh');
    expect(out).toContain('height: 100DVH');
    expect(out).toContain('calc(50vw - 10px)');
  });

  it('normalizes customUnits keys', async () => {
    const out = await run(`.a { height: 100cqh; }`, { customUnits: { CQH: 'vh' } });
    expect(out).toContain('height: 100vh');
  });
});

describe('single-value property filters', () => {
  it('accepts a bare string for onlyProperties', async () => {
    const out = await run(`.a { height: 100dvh; width: 100dvw; }`, {
      onlyProperties: 'height',
    });
    expect(out).toContain('height: 100vh');
    expect(out).not.toContain('width: 100vw');
  });

  it('accepts a bare RegExp for excludeProperties', async () => {
    const out = await run(`.a { padding-top: 10dvh; height: 100dvh; }`, {
      excludeProperties: /^padding/,
    });
    expect(out).not.toContain('padding-top: 10vh');
    expect(out).toContain('height: 100vh');
  });
});

describe('preserve: false consistency', () => {
  it('removes original even when fallback already exists (dedup skip)', async () => {
    const out = await run(`.a { height: 100vh; height: 100dvh; }`, { preserve: false });
    expect(out).toContain('height: 100vh');
    expect(out).not.toContain('100dvh');
  });

  it('removes original at-rule, keeping only the fallback', async () => {
    const out = await run(`@media (min-height: 100dvh) { .a { color: red; } }`, {
      preserve: false,
    });
    expect(out).toContain('@media (min-height: 100vh)');
    expect(out).not.toContain('100dvh');
  });
});

describe('customUnits validation', () => {
  it('rejects identity mappings at init', () => {
    expect(() => plugin({ customUnits: { dvh: 'dvh' } })).toThrow('cycle');
  });

  it('rejects mapping cycles at init', () => {
    expect(() => plugin({ customUnits: { dvh: 'svh', svh: 'dvh' } })).toThrow('cycle');
  });

  it('allows chains that terminate', async () => {
    const out = await run(`.a { height: 100cqh; }`, { customUnits: { cqh: 'svh' } });
    expect(out).toContain('height: 100svh');
    expect(out).toContain('height: 100cqh');
  });
});

describe('per-run stats isolation', () => {
  it('reports independent stats when one plugin instance processes multiple files', async () => {
    const collected: TransformStats[] = [];
    const shared = plugin({ onComplete: (s: TransformStats) => collected.push(s) });

    await Promise.all([
      postcss([shared]).process('.a { height: 100dvh; } .b { width: 100dvw; }', {
        from: 'a.css',
      }),
      postcss([shared]).process('.c { height: 100dvh; }', { from: 'b.css' }),
    ]);

    const counts = collected.map((s) => s.declarations).sort();
    expect(counts).toEqual([1, 2]);
  });
});
