import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string) {
  const result = await postcss([plugin()]).process(input, { from: undefined });
  return result.css;
}

describe('@supports support', () => {
  it('transforms viewport units inside @supports params', async () => {
    const input = `
      @supports (height: 100dvh) {
        .box {
          height: 100dvh;
        }
      }
    `;

    const out = await run(input);

    // expression fallback
    expect(out).toContain('@supports (height: 100vh)');
    expect(out).toContain('@supports (height: 100dvh)');

    // inside rules
    expect(out).toContain('height: 100vh;');
    expect(out).toContain('height: 100dvh;');
  });

  it('works with nested @supports', async () => {
    const input = `
      @supports (width: 100dvw) {
        @supports (height: 100dvh) {
          .block { width: 100dvw; height: 100dvh; }
        }
      }
    `;

    const out = await run(input);

    // first level
    expect(out).toContain('@supports (width: 100vw)');
    expect(out).toContain('@supports (width: 100dvw)');

    // second level
    expect(out).toContain('@supports (height: 100vh)');
    expect(out).toContain('@supports (height: 100dvh)');

    // declarations
    expect(out).toContain('width: 100vw;');
    expect(out).toContain('width: 100dvw;');
    expect(out).toContain('height: 100vh;');
    expect(out).toContain('height: 100dvh;');
  });
});
