import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string, opts = {}) {
  const result = await postcss([plugin(opts)]).process(input, { from: undefined });
  return result.css;
}

describe('un-flattened nested CSS (plugin runs before preset-env/nesting)', () => {
  it('transforms declarations inside nested rules', async () => {
    const out = await run(`.card { color: red; & .inner { height: 100dvh; } }`);
    expect(out).toContain('& .inner { height: 100vh; height: 100dvh; }');
  });

  it('transforms nested @media params and contents', async () => {
    const out = await run(`.card { @media (min-height: 50dvh) { width: 10dvw; } }`);
    expect(out).toContain('@media (min-height: 50vh)');
    expect(out).toContain('@media (min-height: 50dvh)');
    expect(out).toContain('width: 10vw');
  });

  it('preserve: false removes originals in nested rules', async () => {
    const out = await run(`.card { & .inner { height: 100dvh; } }`, { preserve: false });
    expect(out).toContain('height: 100vh');
    expect(out).not.toContain('dvh');
  });
});

describe('real-world value shapes', () => {
  it('keeps !important on both fallback and original', async () => {
    const out = await run(`.a { height: 100dvh !important; }`);
    expect(out).toContain('height: 100vh !important');
    expect(out).toContain('height: 100dvh !important');
  });

  it('transforms every unit in a multi-value shorthand', async () => {
    const out = await run(`.a { inset: 1dvh 2svw 3lvb 4dvmax; }`);
    expect(out).toContain('inset: 1vh 2vw 3vb 4vmax');
    expect(out).toContain('inset: 1dvh 2svw 3lvb 4dvmax');
  });

  it('transforms the line-height component of the font shorthand', async () => {
    const out = await run(`.a { font: 16px/1.2dvh sans-serif; }`);
    expect(out).toContain('font: 16px/1.2vh sans-serif');
  });

  it('handles calc with repeated subtraction like dashboard layouts', async () => {
    const out = await run(`.grid { height: calc(100dvh - 120px - 64px); }`);
    expect(out).toContain('height: calc(100vh - 120px - 64px)');
    expect(out).toContain('height: calc(100dvh - 120px - 64px)');
  });

  it('does not duplicate when a manual @supports ladder already exists', async () => {
    const input = `.player { height: 100vh; }
@supports (height: 100dvh) { .player { height: 100dvh; } }`;
    const out = await run(input);
    expect(out).toContain('@supports (height: 100vh)');
    expect((out.match(/height: 100vh/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
