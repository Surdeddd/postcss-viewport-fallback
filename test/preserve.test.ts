import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('preserve option', () => {
  it('preserve: true (default) keeps both fallback and original', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin()]).process(input, { from: undefined });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).toContain('height: 100dvh');
  });

  it('preserve: false removes original, keeps only fallback', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ preserve: false })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).not.toContain('100dvh');
  });

  it('preserve: false works with calc()', async () => {
    const input = `.a { width: calc(100dvw - 20px); }`;
    const result = await postcss([plugin({ preserve: false })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('calc(100vw - 20px)');
    expect(result.css).not.toContain('dvw');
  });

  it('replace: true still works as deprecated alias', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ replace: true })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).not.toContain('100dvh');
  });

  it('preserve takes precedence over replace', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ preserve: true, replace: true })]).process(input, {
      from: undefined,
    });
    // preserve: true wins
    expect(result.css).toContain('100dvh');
    expect(result.css).toContain('100vh');
  });
});
