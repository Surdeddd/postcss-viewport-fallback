import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

function run(css: string) {
  return postcss([plugin()])
    .process(css, { from: undefined })
    .then((res) => res.css);
}

describe('@container support', () => {
  it('transforms container query expressions', async () => {
    const input = `
      @container (width > 100dvw) {
        .box { height: 10dvh; }
      }
    `;

    const out = await run(input);

    expect(out).toContain('@container (width > 100vw)');
    expect(out).toContain('@container (width > 100dvw)');

    expect(out).toContain('height: 10vh;');
    expect(out).toContain('height: 10dvh;');
  });

  it('supports nested container queries', async () => {
    const input = `
      @container (width > 50dvw) {
        @container (height > 50dvh) {
          .inner { margin-top: 5dvh; }
        }
      }
    `;

    const out = await run(input);

    // fallback для первого уровня
    expect(out).toContain('(width > 50vw)');
    expect(out).toContain('(width > 50dvw)');

    // fallback для второго уровня
    expect(out).toContain('(height > 50vh)');
    expect(out).toContain('(height > 50dvh)');

    expect(out).toContain('margin-top: 5vh;');
    expect(out).toContain('margin-top: 5dvh;');
  });
});
