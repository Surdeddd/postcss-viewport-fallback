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
