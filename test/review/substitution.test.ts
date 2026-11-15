import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';
import plugin from '../../src';
import type { TransformMeta, TransformStats } from '../../src';
import { run, process } from '../helpers/run';

describe('declarations with var() or env() get their fallback through @supports', () => {
  it('guards the most common shape, calc(100dvh - var())', async () => {
    const out = await run(`.page { min-height: calc(100dvh - var(--header)); }`);
    expect(out).toBe(`.page { min-height: calc(100vh - var(--header)); }
@supports (height: 1dvh) { .page { min-height: calc(100dvh - var(--header)); } }`);
  });

  it('never leaves the modern value in the rule, where legacy browsers would keep it', async () => {
    const out = await run(`a{height:var(--missing,100dvh)}`);
    expect(out).toBe(
      `a{height:var(--missing,100vh)}@supports (height: 1dvh){a{height:var(--missing,100dvh)}}`
    );
  });

  it.each([
    'calc(1dvh + env(safe-area-inset-bottom))',
    'calc(1dvh + ENV(safe-area-inset-bottom))',
    'VAR(--gap, 1dvh)',
    'max(var(--min), 50dvh)',
  ])('treats %s as late-validated', async (value) => {
    const out = await run(`.a { padding-bottom: ${value}; }`);
    expect(out).toContain(
      `@supports (height: 1dvh) { .a { padding-bottom: ${value}; } }`
    );
    expect(out.slice(0, out.indexOf('@supports'))).not.toMatch(/dvh/i);
  });

  it('does not mistake other functions for substitution', async () => {
    const out = await run(
      `.a { width: calc(100dvw - myvar(1px)); height: min(50dvh, 1px); }`
    );
    expect(out).not.toContain('@supports');
    expect(out).toContain('height: min(50vh, 1px); height: min(50dvh, 1px);');
  });

  it('formats a multi-line rule', async () => {
    const out = await run(
      `.page {\n  color: red;\n  height: calc(100dvh - var(--h));\n}\n`
    );
    expect(out).toBe(`.page {
  color: red;
  height: calc(100vh - var(--h));
}
@supports (height: 1dvh) {
  .page {
    height: calc(100dvh - var(--h));
  }
}
`);
  });

  it('re-applies the declarations that follow, so a later longhand still wins', async () => {
    const out = await run(
      `.a { margin: calc(10dvh - var(--x)); margin-top: 5px; color: red; --k: 1; }`
    );
    expect(out)
      .toBe(`.a { margin: calc(10vh - var(--x)); margin-top: 5px; color: red; --k: 1; }
@supports (height: 1dvh) { .a { margin: calc(10dvh - var(--x)); margin-top: 5px; } }`);
  });

  it('merges several such declarations of one rule and keeps their order', async () => {
    const out = await run(
      `.a { top: calc(1dvh + var(--a)); left: calc(2dvh + var(--b)); }`
    );
    expect(out).toBe(`.a { top: calc(1vh + var(--a)); left: calc(2vh + var(--b)); }
@supports (height: 1dvh) { .a { top: calc(1dvh + var(--a)); left: calc(2dvh + var(--b)); } }`);
  });

  it('holds every declaration of the rule once, however many of them need the guard', async () => {
    const out = await run(
      `.a { top: calc(1dvh + var(--a)); inset: calc(2dvh + var(--b)); inset-block: calc(3dvh + var(--c)); inset-inline: 5px; }`
    );
    expect(out)
      .toBe(`.a { top: calc(1vh + var(--a)); inset: calc(2vh + var(--b)); inset-block: calc(3vh + var(--c)); inset-inline: 5px; }
@supports (height: 1dvh) { .a { top: calc(1dvh + var(--a)); inset: calc(2dvh + var(--b)); inset-block: calc(3dvh + var(--c)); inset-inline: 5px; } }`);
  });

  it('does not trust a later declaration of the same property to win in every browser', async () => {
    const out = await run(`.a { height: calc(100dvh - var(--x)); height: stretch; }`);
    expect(out).toBe(`.a { height: calc(100vh - var(--x)); height: stretch; }
@supports (height: 1dvh) { .a { height: calc(100dvh - var(--x)); height: stretch; } }`);
  });

  it('still leaves a custom property that a later one overrides', async () => {
    const input = `.a { --h: calc(100dvh - var(--x)); --h: 50px; }`;
    expect(await run(input, { includeCustomProps: true })).toBe(input);
  });

  it('nests the guard when a later nested block could override it', async () => {
    const out = await run(
      `.card { height: calc(100dvh - var(--x)); & .b { height: 1px; } }`
    );
    expect(out).toBe(
      `.card { height: calc(100vh - var(--x)); @supports (height: 1dvh) { height: calc(100dvh - var(--x)); } & .b { height: 1px; } }`
    );
  });

  it('shares one nested guard between the declarations of a rule that needs nested guards', async () => {
    const result = await process(
      `.card { top: calc(1dvh + var(--a)); inset: calc(2dvh + var(--b)); inset-block: 1px; & .n { inset-block: 2px; } }`
    );
    expect(result.css).toBe(
      `.card { top: calc(1vh + var(--a)); inset: calc(2vh + var(--b)); @supports (height: 1dvh) { top: calc(1dvh + var(--a)); inset: calc(2dvh + var(--b)); inset-block: 1px; } inset-block: 1px; & .n { inset-block: 2px; } }`
    );
    expect(result.warnings()).toHaveLength(0);
    expect(await run(result.css)).toBe(result.css);
  });

  it('opens another nested guard when the unit set changes', async () => {
    const result = await process(
      `.card { top: calc(1dvh + var(--a)); inset: calc(2cqw + var(--b)); & .n { inset-block: 2px; } }`,
      { customUnits: { cqw: 'vw' } }
    );
    expect(result.css).toBe(
      `.card { top: calc(1vh + var(--a)); @supports (height: 1dvh) { top: calc(1dvh + var(--a)); inset: calc(2vw + var(--b)); } inset: calc(2vw + var(--b)); @supports (height: 1cqw) { inset: calc(2cqw + var(--b)); } & .n { inset-block: 2px; } }`
    );
    expect(result.warnings()).toHaveLength(0);
    expect(await run(result.css, { customUnits: { cqw: 'vw' } })).toBe(result.css);
  });

  it('nests the guard, with the following declarations, inside a nested at-rule', async () => {
    const out = await run(
      `.card { @media (min-width: 1px) { height: calc(100dvh - var(--x)); block-size: 0; } }`
    );
    expect(out).toBe(
      `.card { @media (min-width: 1px) { height: calc(100vh - var(--x)); @supports (height: 1dvh) { height: calc(100dvh - var(--x)); block-size: 0; } block-size: 0; } }`
    );
  });

  it('is idempotent', async () => {
    const first = await run(
      `.a { margin: calc(10dvh - var(--x)); margin-top: 5svh; }\n.b { height: var(--h, 100dvh); }`
    );
    expect(await run(first)).toBe(first);
  });

  it('reports one transform with the fallback value', async () => {
    const metas: TransformMeta[] = [];
    let stats: TransformStats | undefined;
    await run(`.a { height: calc(100dvh - var(--x)); }`, {
      onTransform: (meta) => metas.push(meta),
      onComplete: (s) => (stats = s),
    });
    expect(metas).toEqual([
      expect.objectContaining({
        prop: 'height',
        original: 'calc(100dvh - var(--x))',
        fallback: 'calc(100vh - var(--x))',
        selector: '.a',
      }),
    ]);
    expect(stats).toMatchObject({ declarations: 1, skipped: 0 });
  });

  it('throws in strict mode', async () => {
    await expect(
      process(`.a { height: calc(100dvh - var(--x)); }`, { strict: true })
    ).rejects.toThrow('Dynamic viewport unit found: height: calc(100dvh - var(--x))');
  });

  it('is skipped under a guarding @supports, by filters and by control comments', async () => {
    const input = `@supports (height: 1dvh) { .a { height: calc(100dvh - var(--x)); } }
.b { /* postcss-viewport-fallback: off */ height: calc(100dvh - var(--x)); width: calc(1dvw - var(--y)); }`;
    expect(await run(input, { excludeProperties: 'width' })).toBe(input);
  });
});

describe('var()/env() declarations where no guard is possible', () => {
  it('warns and leaves a top-level declaration untouched', async () => {
    const input = `height: calc(100dvh - var(--x)); color: red;`;
    const result = await process(input);
    expect(result.css).toBe(input);
    expect(result.warnings().map((warning) => warning.text)).toEqual([
      expect.stringContaining('"height"'),
    ]);
  });

  it('warns and leaves a style attribute untouched', async () => {
    const html = `<div style="height: calc(100dvh - var(--x)); width: 10dvw"></div>`;
    const result = await postcss([plugin()]).process(html, {
      from: 'page.html',
      syntax: postcssHtml(),
    });
    expect(result.content).toContain('height: calc(100dvh - var(--x));');
    expect(result.content).not.toContain('calc(100vh');
    expect(result.content).toContain('width: 10vw');
    expect(result.warnings()).toHaveLength(1);
  });
});

describe('var()/env() declarations with other strategies', () => {
  it('css-var rewrites in place and keeps no twin', async () => {
    const out = await run(`.a { height: calc(100dvh - var(--x)); }`, {
      strategy: 'css-var',
    });
    expect(out).toBe(`:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.a { height: calc(calc(var(--pvf-dvh, 1vh) * 100) - var(--x)); }`);
  });

  it('css-var works where a guard would be impossible', async () => {
    const result = await process(
      `@keyframes k { to { height: calc(100dvh - var(--x)); } }`,
      {
        strategy: 'css-var',
      }
    );
    expect(result.css).toContain(
      'to { height: calc(calc(var(--pvf-dvh, 1vh) * 100) - var(--x)); }'
    );
    expect(result.warnings()).toHaveLength(0);
  });

  it('preserve: false replaces in place', async () => {
    const out = await run(`.a { height: calc(100dvh - var(--x)); }`, { preserve: false });
    expect(out).toBe(`.a { height: calc(100vh - var(--x)); }`);
  });

  it('customUnits chains produce a ladder of guards', async () => {
    const out = await run(`.a { height: calc(100cqh - var(--x)); }`, {
      customUnits: { cqh: 'svh' },
    });
    expect(out).toBe(`.a { height: calc(100vh - var(--x)); }
@supports (height: 1dvh) { .a { height: calc(100svh - var(--x)); } }
@supports (height: 1cqh) { .a { height: calc(100cqh - var(--x)); } }`);
  });
});

describe('seed hosts', () => {
  const cssVar = { strategy: 'css-var' as const };

  it('never uses an empty or comment-only style attribute as the seed host', async () => {
    for (const attribute of ['', '/* c */']) {
      const result = await postcss([plugin(cssVar)]).process(
        `<div style="${attribute}"></div><div style="height: 100dvh"></div><style>.b{color:red}</style>`,
        { from: 'page.html', syntax: postcssHtml() }
      );
      expect(result.content).toContain(`<div style="${attribute}"></div>`);
      expect(result.content).toContain('<style>:root, :host { --pvf-dvh: 1vh }');
    }
  });

  it('seeds each stylesheet of a document, so a conditional first block cannot capture them', async () => {
    const result = await postcss([plugin({ ...cssVar, preserve: false })]).process(
      `<style media="print"></style><style>.a{height:100dvh}</style>`,
      { from: 'page.html', syntax: postcssHtml() }
    );
    expect(result.content).toContain('<style media="print"></style>');
    expect(result.content).toContain(`<style>:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.a{height:calc(var(--pvf-dvh, 1vh) * 100)}</style>`);
  });

  it('treats a stylesheet with top-level Sass variables as a stylesheet', async () => {
    const result = await process(`$gap: 4px;\n.a { height: 100dvh; }`, cssVar);
    expect(result.css).toContain(':root, :host { --pvf-dvh: 1vh }');
    expect(result.warnings()).toHaveLength(0);
  });

  it('treats a fragment of nested rules as a fragment', async () => {
    const result = await process(`&:hover { width: 100dvw; }`, cssVar);
    expect(result.css).not.toContain(':root');
    expect(result.warnings()).toHaveLength(1);
  });

  it('recognises a seed written by 1.6 and tops it up', async () => {
    const out = await run(
      `:root { --pvf-dvh: 1vh }\n@supports (height: 1dvh) { :root { --pvf-dvh: 1dvh } }\n.a { height: calc(var(--pvf-dvh, 1vh) * 100); width: 1svw; }`,
      { ...cssVar, preserve: false }
    );
    expect((out.match(/--pvf-dvh: 1vh/g) ?? []).length).toBe(1);
    expect(out).toContain(':root, :host { --pvf-svw: 1vw }');
  });
});

describe('custom property names written with escapes', () => {
  const opts = { includeCustomProps: true };

  it('sees an escaped spelling of the same property as an override', async () => {
    const input = `a{--x:100dvh;--\\78:200px;height:var(--x)}`;
    expect(await run(input, opts)).toBe(input);
  });

  it('recognises a custom property whose dashes are escaped', async () => {
    const out = await run(`a{\\2d -x:100dvh}`, opts);
    expect(out).toBe(`a{\\2d -x:100vh}@supports (height: 1dvh){a{\\2d -x:100dvh}}`);
    expect(await run(`a{\\2d -x:100dvh}`)).toBe(`a{\\2d -x:100dvh}`);
  });
});

describe('dedup ignores a fallback that only belongs to an earlier declaration', () => {
  it('adds a fresh twin when another twin of this run shadows the match', async () => {
    const out = await run(`.a { height: 16dvh; height: 50svh; height: 16dvh; }`);
    expect(out).toBe(
      `.a { height: 16vh; height: 16dvh; height: 50vh; height: 50svh; height: 16vh; height: 16dvh; }`
    );
    expect(await run(out)).toBe(out);
  });

  it('still respects a hand-written ladder with a value in between', async () => {
    const input = `.a { min-height: 100vh; min-height: -webkit-fill-available; min-height: 100dvh; }`;
    expect(await run(input)).toBe(input);
    expect(await run(input, { preserve: false })).toBe(
      `.a { min-height: 100vh; min-height: -webkit-fill-available; }`
    );
  });
});
