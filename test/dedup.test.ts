import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('dedup optimization', () => {
  it('should not add fallback if it already exists', async () => {
    const input = `.a { height: 100vh; height: 100dvh; }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toBe(`.a { height: 100vh; height: 100dvh; }`);
  });

  it('should add fallback if no duplicate exists', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toBe(`.a { height: 100vh; height: 100dvh; }`);
  });

  it('should not duplicate @media fallback', async () => {
    const input = `@media (min-height: 100vh) {} @media (min-height: 100dvh) {}`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toBe(`@media (min-height: 100vh) {} @media (min-height: 100dvh) {}`);
  });

  it('should add @media fallback if no duplicate', async () => {
    const input = `@media (min-height: 100dvh) { .a { color: red; } }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toContain(`@media (min-height: 100vh)`);
    expect(result.css).toContain(`@media (min-height: 100dvh)`);
  });

  it('should not duplicate on repeated plugin runs', async () => {
    const input = `.a { height: 100dvh; }`;
    const first = await postcss([plugin()]).process(input, { from: undefined });
    const second = await postcss([plugin()]).process(first.css, { from: undefined });
    expect(second.css).toBe(`.a { height: 100vh; height: 100dvh; }`);
  });
});
