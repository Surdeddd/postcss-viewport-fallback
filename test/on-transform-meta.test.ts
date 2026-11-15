import { describe, it, expect } from 'vitest';
import type { TransformMeta, ViewportFallbackOptions } from '../src';
import { run } from './helpers/run';

async function metasOf(css: string, opts: ViewportFallbackOptions = {}, from?: string) {
  const metas: TransformMeta[] = [];
  await run(css, { ...opts, onTransform: (meta) => metas.push(meta) }, { from });
  return metas;
}

describe('onTransform meta', () => {
  it('reports the rule selector for a plain declaration', async () => {
    const [meta] = await metasOf(`.a, .b { height: 100dvh; }`);
    expect(meta).toMatchObject({
      prop: 'height',
      original: '100dvh',
      fallback: '100vh',
      selector: '.a, .b',
    });
  });

  it('reports the nearest enclosing rule for a declaration nested in an at-rule', async () => {
    const [meta] = await metasOf(`.card { @media (min-width: 1px) { width: 10dvw; } }`);
    expect(meta.selector).toBe('.card');
  });

  it('reports the innermost rule for nested rules', async () => {
    const [meta] = await metasOf(`.card { & .inner { height: 100dvh; } }`);
    expect(meta.selector).toBe('& .inner');
  });

  it('reports no selector for a top-level declaration instead of dumping the source', async () => {
    const [meta] = await metasOf(`height: 100dvh; color: red;`);
    expect(meta.selector).toBeUndefined();
  });

  it('reports no selector for descriptors inside a top-level at-rule', async () => {
    const [meta] = await metasOf(`@page { margin: 1dvh; }`);
    expect(meta.selector).toBeUndefined();
  });

  it('reports at-rule transforms with the at-rule name as prop', async () => {
    const metas = await metasOf(`@media (min-height: 100dvh) { .a { color: red; } }`);
    expect(metas).toHaveLength(1);
    expect(metas[0]).toMatchObject({
      prop: '@media',
      original: '(min-height: 100dvh)',
      fallback: '(min-height: 100vh)',
    });
    expect(metas[0].selector).toBeUndefined();
  });

  it('reports the enclosing rule for a nested at-rule transform', async () => {
    const metas = await metasOf(`.card { @container (width > 50dvw) { color: red; } }`);
    expect(metas[0]).toMatchObject({ prop: '@container', selector: '.card' });
  });

  it('includes the source file and a 1-based position', async () => {
    const [meta] = await metasOf(`.a {\n  height: 100dvh;\n}`, {}, '/src/app.css');
    expect(meta.file).toBe('/src/app.css');
    expect(meta.loc).toMatchObject({ line: 2, column: 3 });
  });

  it('is not called for dedup skips, guarded or filtered declarations', async () => {
    const metas = await metasOf(
      `.a { height: 100vh; height: 100dvh; width: 1dvw; }
@supports (height: 1dvh) { .b { height: 100dvh; } }`,
      { excludeProperties: 'width' }
    );
    expect(metas).toEqual([]);
  });

  it('reports the css-var rewrite as the fallback', async () => {
    const [meta] = await metasOf(`.a { height: 100dvh; }`, { strategy: 'css-var' });
    expect(meta.fallback).toBe('calc(var(--pvf-dvh, 1vh) * 100)');
  });
});
