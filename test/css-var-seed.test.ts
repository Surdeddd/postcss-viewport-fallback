import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';
import plugin from '../src';
import { run, process } from './helpers/run';

const cssVar = { strategy: 'css-var' as const };

describe('css-var seed placement', () => {
  it('puts the seed on its own lines at the top of a plain stylesheet', async () => {
    const out = await run(`.a { height: 100dvh; }`, cssVar);
    expect(out).toBe(`:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.a { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }`);
  });

  it('inserts after @charset, @import and @namespace so they stay valid', async () => {
    const out = await run(
      `@charset "utf-8";
@import url("theme.css");
@namespace svg url(http://www.w3.org/2000/svg);
.a { height: 100dvh; }`,
      cssVar
    );
    expect(out).toBe(`@charset "utf-8";
@import url("theme.css");
@namespace svg url(http://www.w3.org/2000/svg);
:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.a { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }`);
  });

  it('matches import-like at-rules case-insensitively', async () => {
    const out = await run(`@IMPORT "a.css";\n.a { height: 100dvh; }`, cssVar);
    expect(out.indexOf('@IMPORT')).toBeLessThan(out.indexOf(':root'));
  });

  it('keeps Sass @use and @forward first', async () => {
    const out = await run(
      `@use "sass:math";\n@forward "theme";\n.a { height: 100dvh; }`,
      cssVar
    );
    expect(out.indexOf('@forward')).toBeLessThan(out.indexOf(':root'));
  });

  it('keeps a leading license banner first', async () => {
    const out = await run(`/*! my-lib v1 | MIT */\n.a { height: 100dvh; }`, cssVar);
    expect(
      out.startsWith('/*! my-lib v1 | MIT */\n:root, :host { --pvf-dvh: 1vh }')
    ).toBe(true);
  });

  it('does not treat an @import after a style rule as part of the preamble', async () => {
    const out = await run(`.a { height: 100dvh; }\n@import "late.css";`, cssVar);
    expect(out.startsWith(':root, :host { --pvf-dvh: 1vh }')).toBe(true);
  });

  it('goes above an ordinary leading comment', async () => {
    const out = await run(`/* hero */\n.a { height: 100dvh; }`, cssVar);
    expect(out.startsWith(':root, :host { --pvf-dvh: 1vh }')).toBe(true);
    expect(out).toContain('\n/* hero */\n.a {');
  });

  it('skips over a leading @layer statement on the way to @import', async () => {
    const out = await run(
      `@layer reset, base;\n@import "a.css";\n.a { height: 100dvh; }`,
      cssVar
    );
    expect(
      out.startsWith(
        '@layer reset, base;\n@import "a.css";\n:root, :host { --pvf-dvh: 1vh }'
      )
    ).toBe(true);
  });

  it('stays at the top when only a @layer statement or block leads the file', async () => {
    const statement = await run(`@layer reset, base;\n.a { height: 100dvh; }`, cssVar);
    expect(statement.startsWith(':root, :host { --pvf-dvh: 1vh }')).toBe(true);
    const block = await run(`@layer base { .a { height: 100dvh; } }`, cssVar);
    expect(block.startsWith(':root, :host { --pvf-dvh: 1vh }')).toBe(true);
  });

  it('keeps the indentation of an indented stylesheet', async () => {
    const out = await run(`\n  @import "a.css";\n  .a { height: 100dvh; }\n`, {
      ...cssVar,
      preserve: false,
    });
    expect(out).toBe(`
  @import "a.css";
  :root, :host { --pvf-dvh: 1vh }
  @supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
  .a { height: calc(var(--pvf-dvh, 1vh) * 100); }
`);
  });

  it('adds no control comments around the seed', async () => {
    const out = await run(`.a { height: 100dvh; }`, cssVar);
    expect(out).not.toContain('postcss-viewport-fallback:');
  });

  it('separates the seed from minified input with a line break', async () => {
    const out = await run(`.a{height:100dvh}`, { ...cssVar, preserve: false });
    expect(out).toBe(`:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.a{height:calc(var(--pvf-dvh, 1vh) * 100)}`);
  });
});

describe('css-var seed contents', () => {
  it('seeds the units that were actually rewritten, sorted', async () => {
    const out = await run(`.a { width: 50svw; height: 100dvh; margin: 1dvh; }`, cssVar);
    expect(out).toContain(':root, :host { --pvf-dvh: 1vh; --pvf-svw: 1vw }');
    expect(out).not.toContain('--pvf-lvh');
  });

  it('does not seed units that only appear in at-rule params', async () => {
    const out = await run(`@media (min-height: 50dvh) { .a { color: red; } }`, cssVar);
    expect(out).not.toContain('--pvf-');
  });

  it('does not seed units that were only found in guarded or skipped declarations', async () => {
    const out = await run(
      `@supports (height: 1dvh) { .a { height: 100dvh; } }\n.b { width: 1svw; }`,
      { ...cssVar, excludeProperties: 'width' }
    );
    expect(out).not.toContain('--pvf-');
  });

  it('tops up an existing seed with units that appear later', async () => {
    const first = await run(`.a { height: 100dvh; }`, { ...cssVar, preserve: false });
    const second = await run(`${first}\n.b { width: 50svw; }`, {
      ...cssVar,
      preserve: false,
    });
    expect(second).toContain('--pvf-svw: 1vw');
    expect(second).toContain(
      '@supports (height: 1dvh) { :root, :host { --pvf-svw: 1svw } }'
    );
    expect((second.match(/--pvf-dvh: 1vh/g) ?? []).length).toBe(1);
  });

  it('is idempotent across runs', async () => {
    const first = await run(
      `@import "a.css";\n.a { height: 100dvh; width: 1svw; }`,
      cssVar
    );
    expect(await run(first, cssVar)).toBe(first);
  });

  it('is not rewritten by a second plugin instance in the same pipeline', async () => {
    const result = await postcss([plugin(cssVar), plugin(cssVar)]).process(
      `.a { height: 100dvh; }`,
      { from: undefined }
    );
    expect(result.css).toBe(`:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.a { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }`);
  });
});

describe('css-var seed in documents and fragments', () => {
  const html = (body: string) =>
    postcss([plugin(cssVar)]).process(body, {
      from: 'page.html',
      syntax: postcssHtml(),
    });

  it('never writes the seed into an inline style attribute', async () => {
    const result = await html(
      `<div style="height: 100dvh"></div>\n<style>.panel { width: 50dvw; }</style>`
    );
    const [inline] = result.content.match(/<div style="[^"]*">/) ?? [];
    expect(inline).toContain('height: calc(var(--pvf-dvh, 1vh) * 100);');
    expect(inline).not.toContain(':root');
    expect(result.content).toContain(
      `<style>:root, :host { --pvf-dvh: 1vh; --pvf-dvw: 1vw }`
    );
    expect((result.content.match(/:root, :host \{ --pvf-dvh: 1vh/g) ?? []).length).toBe(
      1
    );
  });

  it('appends after a trailing @import when the units come from another block', async () => {
    const result = await html(
      `<div style="height: 100dvh"></div><style>@import "a.css";</style>`
    );
    expect(result.content).toContain(
      `<style>@import "a.css";\n:root, :host { --pvf-dvh: 1vh }\n@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }</style>`
    );
  });

  it('uses an empty style block as the seed host', async () => {
    const result = await html(`<div style="height: 100dvh"></div><style></style>`);
    expect(result.content).toContain(
      `<style>:root, :host { --pvf-dvh: 1vh }\n@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }</style>`
    );
    expect(result.warnings()).toHaveLength(0);
  });

  it('warns once and injects nothing when only inline styles exist', async () => {
    const result = await html(
      `<div style="height: 100dvh"></div><p style="width: 1dvw"></p>`
    );
    expect(result.content).not.toContain(':root');
    expect(result.content).toContain('calc(var(--pvf-dvh, 1vh) * 100)');
    const warnings = result.warnings().map((warning) => warning.text);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('--pvf-');
  });

  it('does not inject the seed into a declaration-only fragment', async () => {
    const result = await process(`height: 100dvh;\nwidth: 50dvw;`, cssVar);
    expect(result.css).not.toContain(':root');
    expect(result.css).toContain('height: calc(var(--pvf-dvh, 1vh) * 100);');
    expect(result.warnings()).toHaveLength(1);
  });
});
