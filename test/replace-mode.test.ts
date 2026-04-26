import postcss from 'postcss';
import { describe, it, expect } from 'vitest';
import viewportFallback from '../src/plugin/index';

function run(css: string) {
  return postcss([viewportFallback({ replace: true })]).process(css, {
    from: undefined,
  });
}

describe('viewport-fallback / replace mode', () => {
  it('removes original value', async () => {
    const res = await run(`.b { height: 100dvh; }`);

    expect(res.css).toContain('height: 100vh;');
    expect(res.css).not.toContain('100dvh');
  });
});
