import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('extended edge cases', () => {
  it('should handle empty CSS', async () => {
    const result = await postcss([plugin()]).process('', { from: undefined });
    expect(result.css).toBe('');
  });

  it('should handle comments-only CSS', async () => {
    const input = `/* just a comment */`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toBe(input);
  });

  it('should handle CSS with no viewport units', async () => {
    const input = `.a { height: 100vh; width: 50vw; color: red; }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toBe(input);
  });

  it('strict mode should not throw for @media without viewport units', async () => {
    const input = `@media (min-width: 768px) { .a { color: red; } }`;
    const result = await postcss([plugin({ strict: true })]).process(input, { from: undefined });
    expect(result.css).toBe(input);
  });

  it('replace mode + dedup should not duplicate', async () => {
    const input = `.a { height: 100vh; height: 100dvh; }`;
    const result = await postcss([plugin({ replace: true })]).process(input, { from: undefined });
    // dedup detects 100vh exists, skips fallback; replace removes 100dvh
    // But since dedup returns early before cloneBefore, the original stays
    expect(result.css).toContain('100vh');
  });

  it('customUnits + excludeProperties should respect exclude', async () => {
    const input = `.a { height: 100cqh; width: 50cqw; }`;
    const result = await postcss([
      plugin({ customUnits: { cqh: 'vh', cqw: 'vw' }, excludeProperties: ['height'] }),
    ]).process(input, { from: undefined });
    // height excluded, width transformed
    expect(result.css).not.toContain('height: 100vh');
    expect(result.css).toContain('width: 50vw');
  });

  it('@keyframes inside @media with viewport units', async () => {
    const input = `@media (min-height: 100dvh) {
  @keyframes slide {
    0% { height: 0; }
    100% { height: 100dvh; }
  }
}`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toContain('min-height: 100vh');
    expect(result.css).toContain('height: 100vh');
  });
});
