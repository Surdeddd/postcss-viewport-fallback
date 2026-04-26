import postcss from 'postcss';
import postcssHtml from 'postcss-html';
import { describe, it, expect } from 'vitest';
import viewportFallback from '../src/plugin/index';

function run(html: string) {
  return postcss([viewportFallback()]).process(html, {
    from: undefined,
    syntax: postcssHtml(),
  });
}

describe('viewport-fallback / Vue template', () => {
  it('transforms style attributes inside <template>', async () => {
    const html = `
      <template>
        <div style="min-height: 100svh;"></div>
      </template>
    `;

    const res = await run(html);

    expect(res.css).toContain('min-height: 100vh;');
    expect(res.css).toContain('min-height: 100svh;');
  });
});
