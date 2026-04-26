import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string, opts = {}) {
  const result = await postcss([plugin(opts)]).process(input, { from: undefined });
  return result.css.trim();
}

describe('excludeProperties (black list)', () => {
  it('skips excluded properties', async () => {
    const css = `
      .box {
        height: 100dvh; /* обработать */
        width: 100dvw;  /* исключить */
      }
    `;

    const out = await run(css, {
      excludeProperties: ['width'],
    });

    expect(out).toContain('height: 100vh');
    expect(out).toContain('height: 100dvh');

    expect(out).toContain('width: 100dvw'); // untouched
    expect(out).not.toContain('width: 100vw');
  });

  it('does not block others', async () => {
    const css = `.b { margin: 1dvh }`;
    const out = await run(css, { excludeProperties: ['height'] });

    expect(out).toContain('1vh');
    expect(out).toContain('1dvh');
  });
});
