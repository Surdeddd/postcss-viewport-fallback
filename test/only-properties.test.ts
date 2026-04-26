import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string, opts = {}) {
  const result = await postcss([plugin(opts)]).process(input, { from: undefined });
  return result.css.trim();
}

describe('onlyProperties (white list)', () => {
  it('transforms only selected properties', async () => {
    const css = `
      .a {
        height: 100dvh; /* должен быть обработан */
        width: 100dvw;  /* НЕ должен */
      }
    `;

    const out = await run(css, {
      onlyProperties: ['height'],
    });

    expect(out).toContain('height: 100vh');
    expect(out).toContain('height: 100dvh');
    expect(out).toContain('width: 100dvw'); // untouched
    expect(out).not.toContain('width: 100vw');
  });

  it('skips all if property not in list', async () => {
    const css = `.b { height: 100dvh }`;
    const out = await run(css, { onlyProperties: ['width'] });

    expect(out).not.toContain('100vh');
    expect(out).toContain('100dvh'); // untouched
  });
});
