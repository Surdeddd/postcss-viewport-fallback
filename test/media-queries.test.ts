import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string) {
  const { css } = await postcss([plugin()]).process(input, { from: undefined });
  return css.trim();
}

describe('@media support', () => {
  it('transforms units inside @media queries', async () => {
    const css = `
      @media (min-height: 100dvh) {
        .block {
          height: 100dvh;
          width: 50dvw;
        }
      }
    `;

    const out = await run(css);

    // media expression
    expect(out).toContain('(min-height: 100vh)');
    expect(out).toContain('(min-height: 100dvh)');

    // block rules
    expect(out).toContain('height: 100vh');
    expect(out).toContain('height: 100dvh');

    expect(out).toContain('width: 50vw');
    expect(out).toContain('width: 50dvw');
  });

  it('works with deeply nested structures', async () => {
    const css = `
      @media screen {
        @supports (height: 100dvh) {
          .inner {
            padding: calc(10dvh + 2px);
          }
        }
      }
    `;

    const out = await run(css);

    expect(out).toContain('10vh');
    expect(out).toContain('10dvh');
  });
});
