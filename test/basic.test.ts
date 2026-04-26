import postcss from 'postcss';
import { describe, it, expect } from 'vitest';
import viewportFallback from '../src/plugin/index';

function run(css: string, opts = {}) {
  return postcss([viewportFallback(opts)]).process(css, { from: undefined });
}

describe('viewport-fallback / basic', () => {
  it('adds fallback for dvh/dvw', async () => {
    const result = await run(`
      .box {
        height: 100dvh;
        width: 50dvw;
      }
    `);

    expect(result.css).toContain('height: 100vh;');
    expect(result.css).toContain('height: 100dvh;');

    expect(result.css).toContain('width: 50vw;');
    expect(result.css).toContain('width: 50dvw;');
  });

  it('supports lvh/svh', async () => {
    const result = await run(`
      .hero { min-height: 100svh; }
    `);

    expect(result.css).toContain('min-height: 100vh;');
    expect(result.css).toContain('min-height: 100svh;');
  });

  it('supports dvi/dvb → vi/vb', async () => {
    const result = await run(`
      .el {
        inline-size: 100dvi;
        block-size: 100dvb;
      }
    `);

    expect(result.css).toContain('inline-size: 100vi;');
    expect(result.css).toContain('inline-size: 100dvi;');

    expect(result.css).toContain('block-size: 100vb;');
    expect(result.css).toContain('block-size: 100dvb;');
  });

  it('ignores when no viewport units exist', async () => {
    const css = `.block { height: 50vh; }`;
    const result = await run(css);
    expect(result.css.trim()).toBe(css);
  });
});
