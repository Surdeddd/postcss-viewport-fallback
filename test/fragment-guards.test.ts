import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';
import plugin from '../src';
import { process, run } from './helpers/run';

const fragments = { fragmentGuards: true } as const;

describe('fragmentGuards: @supports blocks at the top level of a declaration fragment', () => {
  it('only warns by default', async () => {
    const input = `height: calc(100dvh - var(--x));`;
    const result = await process(input);
    expect(result.css).toBe(input);
    expect(result.warnings()).toHaveLength(1);
  });

  it('nests the guard right after the declaration', async () => {
    const result = await process(`height: calc(100dvh - var(--x));`, fragments);
    expect(result.css).toBe(
      `height: calc(100vh - var(--x)); @supports (height: 1dvh) { height: calc(100dvh - var(--x)); }`
    );
    expect(result.warnings()).toHaveLength(0);
    expect(await run(result.css, fragments)).toBe(result.css);
  });

  it('repeats the declarations that follow', async () => {
    expect(await run(`margin: calc(1dvh - var(--x));\nmargin-top: 0;`, fragments)).toBe(
      `margin: calc(1vh - var(--x));\n@supports (height: 1dvh) {\n  margin: calc(1dvh - var(--x));\n  margin-top: 0;\n}\nmargin-top: 0;`
    );
  });

  it('keeps a minified fragment minified', async () => {
    expect(await run(`height:calc(100dvh - var(--x))`, fragments)).toBe(
      `height:calc(100vh - var(--x));@supports (height: 1dvh) {height:calc(100dvh - var(--x))}`
    );
  });

  it('guards custom properties too', async () => {
    expect(await run(`--h: 100dvh;`, { ...fragments, includeCustomProps: true })).toBe(
      `--h: 100vh; @supports (height: 1dvh) { --h: 100dvh; }`
    );
  });

  it('reaches into an at-rule at the top level of the fragment', async () => {
    expect(
      await run(
        `color: red; @media (min-width: 1px) { height: calc(100dvh - var(--x)); }`,
        fragments
      )
    ).toBe(
      `color: red; @media (min-width: 1px) { height: calc(100vh - var(--x)); @supports (height: 1dvh) { height: calc(100dvh - var(--x)); } }`
    );
  });

  it('does not take a stylesheet for a fragment', async () => {
    const input = `@media (min-width: 1px) { height: calc(100dvh - var(--x)); }\n.a { color: red; }`;
    const result = await process(input, fragments);
    expect(result.css).toBe(input);
    expect(result.warnings()).toHaveLength(1);
  });

  it('never writes an at-rule into a style attribute', async () => {
    const html = `<div style="height: calc(100dvh - var(--x))"></div>`;
    const result = await postcss([plugin(fragments)]).process(html, {
      from: 'page.html',
      syntax: postcssHtml(),
    });
    expect(result.content).toBe(html);
    expect(result.warnings()).toHaveLength(1);
  });
});
