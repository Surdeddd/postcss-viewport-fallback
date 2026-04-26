import postcss from 'postcss';
import { describe, it, expect } from 'vitest';
import viewportFallback from '../src/plugin/index';

function run(css: string) {
  return postcss([viewportFallback()]).process(css, { from: undefined });
}

describe('viewport-fallback / mixed values', () => {
  it('transforms multiple viewport units in one declaration', async () => {
    const css = `
      .b {
        padding: 10dvh 5dvw 2dvh 1dvw;
      }
    `;

    const res = await run(css);

    expect(res.css).toContain('padding: 10vh 5vw 2vh 1vw;');
    expect(res.css).toContain('padding: 10dvh 5dvw 2dvh 1dvw;');
  });
});
