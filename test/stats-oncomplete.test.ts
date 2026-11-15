import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';
import type { TransformStats } from '../src';

describe('onComplete and stats', () => {
  it('should call onComplete with correct declaration count', async () => {
    let stats: TransformStats | undefined;
    const input = `.a { height: 100dvh; width: 50dvw; }`;
    await postcss([plugin({ onComplete: (s) => (stats = s) })]).process(input, {
      from: undefined,
    });
    expect(stats).toBeDefined();
    expect(stats!.declarations).toBe(2);
    expect(stats!.atRules).toBe(0);
  });

  it('should count at-rule transformations', async () => {
    let stats: TransformStats | undefined;
    const input = `@media (min-height: 100dvh) { .a { color: red; } }`;
    await postcss([plugin({ onComplete: (s) => (stats = s) })]).process(input, {
      from: undefined,
    });
    expect(stats!.atRules).toBe(1);
  });

  it('should count skipped (dedup) transformations', async () => {
    let stats: TransformStats | undefined;
    const input = `.a { height: 100vh; height: 100dvh; }`;
    await postcss([plugin({ onComplete: (s) => (stats = s) })]).process(input, {
      from: undefined,
    });
    expect(stats!.skipped).toBe(1);
    expect(stats!.declarations).toBe(0);
  });

  it('should provide timeMs > 0', async () => {
    let stats: TransformStats | undefined;
    const input = `.a { height: 100dvh; }`;
    await postcss([plugin({ onComplete: (s) => (stats = s) })]).process(input, {
      from: undefined,
    });
    expect(stats!.timeMs).toBeGreaterThanOrEqual(0);
  });

  it('should not call onComplete if not provided', async () => {
    const input = `.a { height: 100dvh; }`;
    // Should not throw
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toContain('100vh');
  });
});

describe('stats stay exact when PostCSS revisits nodes', () => {
  async function statsOf(input: string, opts = {}) {
    let stats: TransformStats | undefined;
    const result = await postcss([
      plugin({ ...opts, onComplete: (s) => (stats = s) }),
    ]).process(input, { from: undefined });
    return { stats: stats!, warnings: result.warnings().map((warning) => warning.text) };
  }

  it('does not count an at-rule as a dedup skip when its block changes later', async () => {
    const { stats } = await statsOf(
      `@media (min-height: 100dvh) { .a { height: 100dvh; } }`
    );
    expect(stats).toMatchObject({ declarations: 1, atRules: 1, skipped: 0 });
  });

  it('does not count a twinned at-rule as a dedup skip when its block changes later', async () => {
    const { stats } = await statsOf(
      `@container (min-height: 100dvh) { .a { height: 100dvh; } }`
    );
    expect(stats).toMatchObject({ declarations: 2, atRules: 1, skipped: 0 });
  });

  it('counts nested at-rule twins once each', async () => {
    const { stats } = await statsOf(
      `@container (width > 50dvw) { @container (height > 50dvh) { .a { margin: 5dvh; } } }`
    );
    expect(stats).toMatchObject({ declarations: 4, atRules: 3, skipped: 0 });
  });

  it('logs a twinned at-rule once in verbose mode', async () => {
    const { warnings } = await statsOf(
      `@media (min-height: 100dvh) { .a { height: 100dvh; width: 1dvw; } }`,
      { debug: 'verbose' }
    );
    expect(warnings.filter((text) => text.startsWith('checking: @media'))).toHaveLength(
      1
    );
  });

  it('counts a value rewritten in place once, however many steps its unit takes', async () => {
    const { stats } = await statsOf(`.a { height: var(--x, 1cqh); }`, {
      preserve: false,
      customUnits: { cqh: 'svh' },
    });
    expect(stats).toMatchObject({ declarations: 1, atRules: 0, skipped: 0 });
  });

  it('reports a value rewritten in place once, however many steps its unit takes', async () => {
    const reported: string[] = [];
    await statsOf(`.a { height: var(--x, 1cqh); }`, {
      preserve: false,
      customUnits: { cqh: 'svh' },
      onTransform: (meta: { original: string; fallback: string }) =>
        void reported.push(`${meta.original} -> ${meta.fallback}`),
    });
    expect(reported).toEqual(['var(--x, 1cqh) -> var(--x, 1vh)']);
  });

  it('counts a pre-existing at-rule twin as exactly one dedup skip', async () => {
    const { stats } = await statsOf(
      `@media (min-height: 100vh) { .a { height: 100dvh; } } @media (min-height: 100dvh) { .a { height: 100dvh; } }`
    );
    expect(stats).toMatchObject({ declarations: 2, atRules: 0, skipped: 1 });
  });
});
