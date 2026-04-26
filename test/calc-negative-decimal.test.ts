import postcss from 'postcss';
import { describe, it, expect } from 'vitest';
import viewportFallback from '../src/plugin/index';

function run(css: string) {
  return postcss([viewportFallback()]).process(css, { from: undefined });
}

describe('viewport-fallback / calc & numeric edge cases', () => {
  it('supports calc()', async () => {
    const result = await run(`
      .box { height: calc(100dvh - 32px); }
    `);

    expect(result.css).toContain('calc(100vh - 32px)');
    expect(result.css).toContain('calc(100dvh - 32px)');
  });

  it('supports negative values', async () => {
    const result = await run(`
      .m { margin-top: -12dvh; }
    `);

    expect(result.css).toContain('margin-top: -12vh;');
    expect(result.css).toContain('margin-top: -12dvh;');
  });

  it('supports decimal values', async () => {
    const result = await run(`
      .m { margin-top: 5.75dvw; }
    `);

    expect(result.css).toContain('5.75vw');
    expect(result.css).toContain('5.75dvw');
  });
});
