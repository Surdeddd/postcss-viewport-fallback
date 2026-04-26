import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src/index';

async function run(input: string) {
  const res = await postcss([plugin()]).process(input, { from: undefined });
  return res.css.trim();
}

describe('Viewport Fallback – EXTREME edge cases', () => {
  it('handles double parentheses: calc((100dvh))', async () => {
    const css = `.box { height: calc((100dvh)); }`;
    const out = await run(css);

    expect(out).toContain('calc((100vh))');
    expect(out).toContain('calc((100dvh))');
  });

  it('handles nested calc inside calc: calc(100dvh + calc(50dvw - 10px))', async () => {
    const css = `.box { height: calc(100dvh + calc(50dvw - 10px)); }`;
    const out = await run(css);

    expect(out).toContain('calc(100vh + calc(50vw - 10px))');
    expect(out).toContain('calc(100dvh + calc(50dvw - 10px))');
  });

  it('supports functions min(), max(), clamp()', async () => {
    const css = `
      .box {
        height: min(10dvh, 20dvh);
        width: max(5dvw, 3dvw);
        margin: clamp(5dvh, 20dvw, 30dvh);
      }
    `;

    const out = await run(css);

    expect(out).toContain('min(10vh, 20vh)');
    expect(out).toContain('max(5vw, 3vw)');
    expect(out).toContain('clamp(5vh, 20vw, 30vh)');
  });

  it('handles minmax() inside grid templates', async () => {
    const css = `.grid { grid-template-rows: minmax(10dvh, 20dvh); }`;
    const out = await run(css);

    expect(out).toContain('minmax(10vh, 20vh)');
    expect(out).toContain('minmax(10dvh, 20dvh)');
  });

  it('does NOT transform inside url()', async () => {
    const css = `.box { background: url("./image-100dvh.png"); }`;
    const out = await run(css);

    // Никаких замен — только если unit был бы внутри word токена
    expect(out).not.toContain('100vh.png');
    expect(out).toContain('100dvh.png');
  });

  it('does NOT transform inside strings "" or quotes \'\'', async () => {
    const css = `.box { content: "height: 100dvh"; }`;
    const out = await run(css);

    expect(out).toContain('"height: 100dvh"');
    expect(out).not.toContain('"height: 100vh"');
  });

  it('handles mixed spacing and tabs', async () => {
    const css = `
      .box {
        height:\t100dvh ;
        width:
          \t   50dvw;
      }
    `;
    const out = await run(css);

    expect(out).toContain('100vh');
    expect(out).toContain('50vw');
  });

  it('supports calc with multiple nested levels', async () => {
    const css = `
      .box {
        height: calc(10dvh + calc(5dvh + calc(2dvw - 1dvh)));
      }
    `;
    const out = await run(css);

    expect(out).toContain('10vh');
    expect(out).toContain('5vh');
    expect(out).toContain('2vw');
    expect(out).toContain('1vh');
  });

  it('transforms inside @supports conditions', async () => {
    const css = `
      @supports (height: 100dvh) {
        .box { height: 100dvh; }
      }
    `;
    const out = await run(css);

    // fallback @supports added
    expect(out).toContain('@supports (height: 100vh)');
    expect(out).toContain('(height: 100dvh)');
  });

  it('transforms inside @container queries', async () => {
    const css = `
      @container (height > 50dvh) {
        .box { height: 10dvh; }
      }
    `;

    const out = await run(css);

    expect(out).toContain('(height > 50vh)');
    expect(out).toContain('height: 10vh');
  });

  it('transforms inside custom property fallback chains var()', async () => {
    const css = `.box { height: var(--a, var(--b, 10dvh)); }`;
    const out = await run(css);

    expect(out).toContain('var(--a, var(--b, 10vh))');
    expect(out).toContain('var(--a, var(--b, 10dvh))');
  });

  it('does NOT transform inside @keyframes percentages', async () => {
    const css = `
      @keyframes move {
        0% { top: 0; }
        100% { top: 10dvh; }
      }
    `;

    const out = await run(css);

    expect(out).toContain('top: 10vh');
    expect(out).toContain('top: 10dvh');
  });

  it('ignores malformed values gracefully', async () => {
    const css = `.box { height: calc(100dvh + ); }`;
    const out = await run(css);

    // Должно просто не упасть, но преобразования остаются
    expect(out).toContain('100vh');
  });
});
