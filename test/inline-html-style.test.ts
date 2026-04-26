import { describe, it, expect } from 'vitest';
import plugin from '../src/plugin/index';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';

async function runHtml(html: string) {
  const res = await postcss([plugin()]).process(html, {
    from: undefined,
    syntax: postcssHtml(),
  });

  return res.content;
}

describe('transforms inline style="" attributes', () => {
  it('works with inline HTML style attributes', async () => {
    const input = `
      <div style="height: 100dvh; width: 50dvw"></div>
    `;

    const out = await runHtml(input);

    expect(out).toContain('height: 100vh;');
    expect(out).toContain('height: 100dvh;');
    expect(out).toContain('width: 50vw;');
    expect(out).toContain('width: 50dvw');
  });
});
