import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string) {
  const result = await postcss([plugin()]).process(input, { from: undefined });
  return result.css;
}

describe('@supports support', () => {
  it('keeps a feature query for the unit and its block untouched', async () => {
    const input = `
      @supports (height: 100dvh) {
        .box {
          height: 100dvh;
        }
      }
    `;

    expect(await run(input)).toBe(input);
  });

  it('keeps nested feature queries untouched', async () => {
    const input = `
      @supports (width: 100dvw) {
        @supports (height: 100dvh) {
          .block { width: 100dvw; height: 100dvh; }
        }
      }
    `;

    expect(await run(input)).toBe(input);
  });

  it('adds fallbacks inside a feature query for something else', async () => {
    const input = `
      @supports (display: grid) {
        .block { width: 100dvw; height: 100dvh; }
      }
    `;

    const out = await run(input);

    expect(out).toContain('@supports (display: grid)');
    expect(out).toContain('width: 100vw;');
    expect(out).toContain('width: 100dvw;');
    expect(out).toContain('height: 100vh;');
    expect(out).toContain('height: 100dvh;');
  });
});
