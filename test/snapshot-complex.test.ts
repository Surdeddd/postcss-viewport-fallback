import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

describe('snapshot complex cases', () => {
  it('large css snapshot', async () => {
    const input = `
      .a { height: 100dvh; }
      .b { width: calc(50dvw - 10px); }
      .c { margin: 1dvh 2dvw; }
    `;

    const result = await postcss([plugin()]).process(input, { from: undefined });

    expect(result.css).toMatchInlineSnapshot(`
      "
            .a { height: 100vh; height: 100dvh; }
            .b { width: calc(50vw - 10px); width: calc(50dvw - 10px); }
            .c { margin: 1vh 2vw; margin: 1dvh 2dvw; }
          "
    `);
  });
});
