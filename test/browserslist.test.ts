import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('browserslist option', () => {
  it('browserslist: false (default) always transforms', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toContain('100vh');
  });

  it('browserslist: true with default browser scope still transforms', async () => {
    // no browserslist config in this repo -> defaults include browsers without dvh support
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ browserslist: true })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('100vh');
  });
});
