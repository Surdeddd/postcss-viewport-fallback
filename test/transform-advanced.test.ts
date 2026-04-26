import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index';

async function run(input: string) {
  const res = await postcss([plugin()]).process(input, { from: undefined });
  return res.css.trim();
}

describe('Advanced viewport-unit transforms', () => {
  it('transforms inside calc() mixed expression', async () => {
    const css = `
      .box {
        height: calc(100dvh - 20px + 2dvw);
      }
    `;

    const out = await run(css);

    expect(out).toContain('calc(100vh - 20px + 2vw)');
    expect(out).toContain('calc(100dvh - 20px + 2dvw)');
  });

  it('transforms inside var() default value', async () => {
    const css = `
      .box {
        height: var(--h, 10dvh);
      }
    `;

    const out = await run(css);

    expect(out).toContain('var(--h, 10vh)');
    expect(out).toContain('var(--h, 10dvh)');
  });

  it('transforms nested calc(var(...)) deeply', async () => {
    const css = `
      .box {
        height: calc(var(--x, calc(5dvh + 2dvw)) - 10px);
      }
    `;

    const out = await run(css);

    expect(out).toContain('calc(var(--x, calc(5vh + 2vw)) - 10px)');
    expect(out).toContain('calc(var(--x, calc(5dvh + 2dvw)) - 10px)');
  });

  it('handles multiple viewport units in one declaration', async () => {
    const css = `
      .box {
        margin: 1dvh 2dvw 3svh 4lvh;
      }
    `;

    const out = await run(css);

    expect(out).toContain('1vh 2vw 3vh 4vh');
    expect(out).toContain('1dvh 2dvw 3svh 4lvh');
  });

  it('handles negative numbers', async () => {
    const css = `
      .box { top: -10dvh; }
    `;

    const out = await run(css);

    expect(out).toContain('top: -10vh;');
    expect(out).toContain('top: -10dvh;');
  });

  it('supports numbers with decimals', async () => {
    const css = `
      .box { width: 12.5dvw; }
    `;

    const out = await run(css);

    expect(out).toContain('12.5vw');
    expect(out).toContain('12.5dvw');
  });

  it('transforms values with trailing punctuation', async () => {
    const css = `
      .box { height: calc(100dvh); width: 50dvw; }
    `;

    const out = await run(css);

    expect(out).toContain('100vh)');
    expect(out).toContain('100dvh)');
    expect(out).toContain('50vw;');
    expect(out).toContain('50dvw;');
  });

  it('transforms multiple viewport units separated by commas', async () => {
    const css = `
      .box { grid-template-rows: 10dvh, 20dvh, 30dvh; }
    `;

    const out = await run(css);

    expect(out).toContain('10vh, 20vh, 30vh');
    expect(out).toContain('10dvh, 20dvh, 30dvh');
  });

  it('supports nested functions inside calc()', async () => {
    const css = `
      .box { height: calc(max(10dvh, 5dvh) + min(3dvw, 2dvw)); }
    `;

    const out = await run(css);

    expect(out).toContain('max(10vh, 5vh)');
    expect(out).toContain('min(3vw, 2vw)');
  });

  it('supports weird whitespaces and line breaks', async () => {
    const css = `
      .box {
        height:
          calc(
            100dvh
            -
            50px
          );
      }
    `;

    const out = await run(css);

    expect(out).toContain('100vh');
    expect(out).toContain('100dvh');
  });
});
