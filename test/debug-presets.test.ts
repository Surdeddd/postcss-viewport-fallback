import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('debug presets', () => {
  it('debug: "verbose" should warn per-transform and summary', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ debug: 'verbose' })]).process(input, {
      from: undefined,
    });

    const warnings = result.warnings().map((w) => w.text);
    expect(warnings.some((w) => w.includes('checking:'))).toBe(true);
    expect(warnings.some((w) => w.includes('→'))).toBe(true);
    expect(warnings.some((w) => w.includes('declarations'))).toBe(true);
  });

  it('debug: true should behave like verbose', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ debug: true })]).process(input, {
      from: undefined,
    });

    const warnings = result.warnings().map((w) => w.text);
    expect(warnings.some((w) => w.includes('checking:'))).toBe(true);
    expect(warnings.some((w) => w.includes('declarations'))).toBe(true);
  });

  it('debug: "minimal" should only warn summary, no per-transform', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ debug: 'minimal' })]).process(input, {
      from: undefined,
    });

    const warnings = result.warnings().map((w) => w.text);
    // Should NOT have per-transform warnings
    expect(warnings.some((w) => w.includes('checking:'))).toBe(false);
    expect(warnings.some((w) => w.includes('→'))).toBe(false);
    // Should have summary
    expect(warnings.some((w) => w.includes('declarations'))).toBe(true);
  });

  it('debug: "verbose" only logs candidates, not every declaration', async () => {
    const input = `.a { color: red; margin: 0; height: 100dvh; }`;
    const result = await postcss([plugin({ debug: 'verbose' })]).process(input, {
      from: undefined,
    });

    const warnings = result.warnings().map((w) => w.text);
    expect(warnings.some((w) => w.includes('color'))).toBe(false);
    expect(warnings.some((w) => w.includes('margin'))).toBe(false);
    expect(warnings.filter((w) => w.includes('checking:'))).toHaveLength(1);
  });

  it('debug: "verbose" logs at-rule candidates the same way', async () => {
    const input = `@media (min-width: 1px) { .a { color: red; } } @media (min-height: 1dvh) { .a { color: red; } }`;
    const result = await postcss([plugin({ debug: 'verbose' })]).process(input, {
      from: undefined,
    });

    const warnings = result.warnings().map((w) => w.text);
    expect(warnings.filter((w) => w.includes('checking:'))).toEqual([
      'checking: @media (min-height: 1dvh)',
    ]);
    expect(warnings).toContain('@media: (min-height: 1dvh) → (min-height: 1vh)');
  });

  it('debug: "minimal" mentions dedup skips in the summary', async () => {
    const input = `.a { height: 100vh; height: 100dvh; } .b { width: 1dvw; }`;
    const result = await postcss([plugin({ debug: 'minimal' })]).process(input, {
      from: undefined,
    });

    const [summary] = result.warnings().map((w) => w.text);
    expect(summary).toMatch(
      /^\[viewport-fallback\] 1 declarations, 0 at-rules transformed, 1 skipped \(dedup\) \(\d+(\.\d+)?ms\)$/
    );
  });

  it('debug: false should produce no warnings', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ debug: false })]).process(input, {
      from: undefined,
    });

    expect(result.warnings()).toHaveLength(0);
  });
});
