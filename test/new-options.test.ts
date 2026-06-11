import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';
import type { TransformStats } from '../src';

async function run(input: string, opts = {}) {
  const result = await postcss([plugin(opts)]).process(input, { from: undefined });
  return result.css;
}

describe('fastSkip', () => {
  it('skips files without viewport units and still fires onComplete', async () => {
    let stats: TransformStats | undefined;
    const input = `.a { height: 100vh; color: red; }`;
    const out = await run(input, { fastSkip: true, onComplete: (s: TransformStats) => (stats = s) });
    expect(out).toBe(input);
    expect(stats).toEqual({ declarations: 0, atRules: 0, skipped: 0, timeMs: 0 });
  });

  it('still transforms files that contain viewport units', async () => {
    const out = await run(`.a { height: 100dvh; }`, { fastSkip: true });
    expect(out).toContain('height: 100vh');
    expect(out).toContain('height: 100dvh');
  });
});

describe('browserslist query', () => {
  it('skips the plugin when the query targets support dynamic viewport units', async () => {
    const input = `.a { height: 100dvh; }`;
    const out = await run(input, { browserslist: 'chrome >= 130' });
    expect(out).toBe(input);
  });

  it('transforms when the query includes browsers without support', async () => {
    const out = await run(`.a { height: 100dvh; }`, { browserslist: 'ie 11' });
    expect(out).toContain('height: 100vh');
  });

  it('accepts an array query', async () => {
    const input = `.a { height: 100dvh; }`;
    const out = await run(input, { browserslist: ['chrome >= 130', 'firefox >= 130'] });
    expect(out).toBe(input);
  });
});

describe('control comment ranges (disable/enable)', () => {
  it('disables all following siblings until enable', async () => {
    const out = await run(`.a {
  /* postcss-viewport-fallback: disable */
  height: 100dvh;
  width: 50dvw;
  /* postcss-viewport-fallback: enable */
  margin-top: 10dvh;
}`);
    expect(out).not.toContain('height: 100vh');
    expect(out).not.toContain('width: 50vw');
    expect(out).toContain('margin-top: 10vh');
  });

  it('cascades into nested blocks', async () => {
    const out = await run(`/* postcss-viewport-fallback: disable */
.a { height: 100dvh; }
@media (min-height: 50dvh) { .b { width: 10dvw; } }
/* postcss-viewport-fallback: enable */
.c { height: 100dvh; }`);
    expect(out).not.toContain('height: 100vh; height: 100dvh; }\n@media');
    expect(out).not.toContain('min-height: 50vh');
    expect(out).not.toContain('width: 10vw');
    expect(out).toContain('.c { height: 100vh; height: 100dvh; }');
  });

  it('keeps point-form off scoped to the next declaration only', async () => {
    const out = await run(`.a {
  /* postcss-viewport-fallback: off */
  height: 100dvh;
  width: 50dvw;
}`);
    expect(out).not.toContain('height: 100vh');
    expect(out).toContain('width: 50vw');
  });
});
