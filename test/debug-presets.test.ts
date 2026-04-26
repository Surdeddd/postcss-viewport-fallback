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
    const result = await postcss([plugin({ debug: true })]).process(input, { from: undefined });

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

  it('debug: false should produce no warnings', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ debug: false })]).process(input, { from: undefined });

    expect(result.warnings()).toHaveLength(0);
  });
});
