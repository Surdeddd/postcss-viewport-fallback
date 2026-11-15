import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';
import plugin from '../src';
import type { TransformStats, ViewportFallbackOptions } from '../src';

const page = `<html><head>
<style>.hero { height: 100dvh; }</style>
<style>.panel { width: 50dvw; }</style>
<style>.plain { color: red; }</style>
</head><body><div style="margin-top: 1dvh"></div></body></html>`;

function processHtml(html: string, opts: ViewportFallbackOptions = {}) {
  return postcss([plugin(opts)]).process(html, {
    from: 'page.html',
    syntax: postcssHtml(),
  });
}

describe('multi-root documents (postcss-html)', () => {
  it('fires onComplete exactly once with totals for the whole document', async () => {
    const calls: TransformStats[] = [];
    await processHtml(page, { onComplete: (stats) => calls.push({ ...stats }) });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ declarations: 3, atRules: 0, skipped: 0 });
  });

  it('emits the debug summary exactly once', async () => {
    const result = await processHtml(page, { debug: 'minimal' });
    expect(result.warnings()).toHaveLength(1);
    expect(result.warnings()[0].text).toContain('3 declarations');
  });

  it('fires onComplete once when fastSkip short-circuits the document', async () => {
    let calls = 0;
    await processHtml(`<style>.a{color:red}</style><style>.b{color:blue}</style>`, {
      fastSkip: true,
      onComplete: () => calls++,
    });
    expect(calls).toBe(1);
  });

  it('fires onComplete once when browserslist disables the plugin', async () => {
    let calls = 0;
    await processHtml(`<style>.a{height:1dvh}</style><style>.b{color:blue}</style>`, {
      browserslist: 'chrome >= 130',
      onComplete: () => calls++,
    });
    expect(calls).toBe(1);
  });

  it('keeps control-comment ranges scoped to their own style block', async () => {
    const result = await processHtml(
      `<style>/* postcss-viewport-fallback: disable */
.a { height: 100dvh; }</style>
<style>.b { height: 50dvh; }</style>`
    );
    expect(result.content).not.toContain('height: 100vh');
    expect(result.content).toContain('.b { height: 50vh; height: 50dvh; }');
  });

  it('reports independent totals for two documents processed by one plugin instance', async () => {
    const calls: number[] = [];
    const shared = plugin({ onComplete: (stats) => calls.push(stats.declarations) });
    await Promise.all([
      postcss([shared]).process(page, { from: 'a.html', syntax: postcssHtml() }),
      postcss([shared]).process(`<style>.x { height: 1dvh; }</style>`, {
        from: 'b.html',
        syntax: postcssHtml(),
      }),
    ]);
    expect(calls.sort()).toEqual([1, 3]);
  });
});
