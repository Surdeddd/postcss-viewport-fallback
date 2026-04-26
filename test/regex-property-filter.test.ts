import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('regex property filtering', () => {
  it('onlyProperties with RegExp', async () => {
    const input = `.a { height: 100dvh; width: 50dvw; margin: 10dvh; }`;
    const result = await postcss([plugin({ onlyProperties: [/^height$/] })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).not.toContain('width: 50vw');
    expect(result.css).not.toContain('margin: 10vh');
  });

  it('onlyProperties with mixed string and RegExp', async () => {
    const input = `.a { height: 100dvh; min-height: 50dvh; max-height: 80dvh; width: 50dvw; }`;
    const result = await postcss([
      plugin({ onlyProperties: ['width', /^(min|max)-height$/] }),
    ]).process(input, { from: undefined });
    expect(result.css).toContain('width: 50vw');
    expect(result.css).toContain('min-height: 50vh');
    expect(result.css).toContain('max-height: 80vh');
    // plain "height" is NOT in the filter
    expect(result.css).not.toMatch(/(?<!\w-)height: 100vh/);
  });

  it('excludeProperties with RegExp', async () => {
    const input = `.a { height: 100dvh; padding-top: 10dvh; padding-bottom: 5dvh; }`;
    const result = await postcss([plugin({ excludeProperties: [/^padding/] })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).not.toContain('padding-top: 10vh');
    expect(result.css).not.toContain('padding-bottom: 5vh');
  });

  it('string filter still works', async () => {
    const input = `.a { height: 100dvh; width: 50dvw; }`;
    const result = await postcss([plugin({ onlyProperties: ['height'] })]).process(input, {
      from: undefined,
    });
    expect(result.css).toContain('height: 100vh');
    expect(result.css).not.toContain('width: 50vw');
  });
});
