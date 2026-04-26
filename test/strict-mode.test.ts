import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('strict mode', () => {
  it('should throw when dynamic viewport unit is found', async () => {
    const input = `.a { height: 100dvh; }`;
    await expect(
      postcss([plugin({ strict: true })]).process(input, { from: undefined })
    ).rejects.toThrow('Dynamic viewport unit found');
  });

  it('should include property and value in error message', async () => {
    const input = `.a { width: calc(50dvw - 10px); }`;
    await expect(
      postcss([plugin({ strict: true })]).process(input, { from: undefined })
    ).rejects.toThrow('width');
  });

  it('should not throw when no viewport units exist', async () => {
    const input = `.a { height: 100vh; }`;
    const result = await postcss([plugin({ strict: true })]).process(input, { from: undefined });
    expect(result.css).toBe(`.a { height: 100vh; }`);
  });

  it('should not throw when strict is false', async () => {
    const input = `.a { height: 100dvh; }`;
    const result = await postcss([plugin({ strict: false })]).process(input, { from: undefined });
    expect(result.css).toContain('100vh');
  });
});
