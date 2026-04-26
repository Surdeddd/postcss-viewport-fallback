import postcss from 'postcss';
import { describe, it, expect, vi } from 'vitest';
import viewportFallback from '../src/plugin/index';

function run(css: string, opts: any = {}) {
  return postcss([viewportFallback(opts)]).process(css, { from: undefined });
}

describe('viewport-fallback / debug + callback', () => {
  it('calls onTransform()', async () => {
    const cb = vi.fn();

    await run(`.b { height: 100dvh; }`, { onTransform: cb });

    expect(cb).toHaveBeenCalledTimes(1);

    expect(cb.mock.calls[0][0]).toMatchObject({
      prop: 'height',
      original: '100dvh',
      fallback: '100vh',
    });
  });

  it('debug outputs warnings via result.warn()', async () => {
    const result = await run(`.b { height: 100dvh; }`, { debug: true });

    const warnings = result.warnings().map((w) => w.text);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('declarations'))).toBe(true);
  });
});
