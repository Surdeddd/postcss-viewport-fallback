import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('custom unit mapping', () => {
  it('should transform custom unit', async () => {
    const input = `.a { height: 100cqh; }`;
    const result = await postcss([plugin({ customUnits: { cqh: 'vh' } })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).toContain('height: 100cqh');
  });

  it('should transform custom unit in calc()', async () => {
    const input = `.a { width: calc(100cqw - 20px); }`;
    const result = await postcss([plugin({ customUnits: { cqw: 'vw' } })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('calc(100vw - 20px)');
  });

  it('should transform custom unit in @media', async () => {
    const input = `@media (min-height: 50cqh) { .a { color: red; } }`;
    const result = await postcss([plugin({ customUnits: { cqh: 'vh' } })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('(min-height: 50vh)');
    expect(result.css).toContain('(min-height: 50cqh)');
  });

  it('should keep built-in units when custom units are added', async () => {
    const input = `.a { height: 100dvh; width: 50cqw; }`;
    const result = await postcss([plugin({ customUnits: { cqw: 'vw' } })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).toContain('width: 50vw');
  });

  it('should allow overriding built-in units', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ customUnits: { dvh: 'svh' } })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100svh');
  });

  it('should handle empty customUnits', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ customUnits: {} })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
  });

  it('should handle multiple custom units', async () => {
    const input = `.a { height: 100cqh; width: 50cqw; }`;
    const result = await postcss([
      plugin({ customUnits: { cqh: 'vh', cqw: 'vw' } }),
    ]).process(input, { from: undefined });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).toContain('width: 50vw');
  });
});
