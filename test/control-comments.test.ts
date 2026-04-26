import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('control comments', () => {
  it('should skip transformation when preceded by disable comment', async () => {
    const input = `.a {
  /* postcss-viewport-fallback: off */
  height: 100dvh;
}`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).not.toContain('100vh');
    expect(result.css).toContain('100dvh');
  });

  it('should still transform other declarations in the same rule', async () => {
    const input = `.a {
  /* postcss-viewport-fallback: off */
  height: 100dvh;
  width: 50dvw;
}`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    // height is skipped (preceded by comment), width is not
    expect(result.css).toContain('width: 50vw');
    expect(result.css).not.toContain('height: 100vh');
  });

  it('should not affect declarations without the comment', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toContain('100vh');
  });

  it('should skip @media transformation when preceded by disable comment', async () => {
    const input = `/* postcss-viewport-fallback: off */
@media (min-height: 100dvh) { .a { color: red; } }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).not.toContain('min-height: 100vh');
  });

  it('should skip @supports transformation when preceded by disable comment', async () => {
    const input = `/* postcss-viewport-fallback: off */
@supports (height: 100dvh) { .a { color: red; } }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).not.toContain('height: 100vh');
  });
});
