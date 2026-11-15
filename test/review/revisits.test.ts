import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { run } from '../helpers/run';

const cq = { customUnits: { cqw: 'vw' } };

describe('@supports blocks stay proportional to the rule', () => {
  it('writes one block for all built-in units', async () => {
    const out = await run(`.a{height:var(--x,1dvh);height:var(--x,2svw)}`);
    expect(out).toBe(
      `.a{height:var(--x,1vh);height:var(--x,2vw)}` +
        `@supports (height: 1dvh){.a{height:var(--x,1dvh);height:var(--x,2svw)}}`
    );
    expect(await run(out)).toBe(out);
  });

  it('writes one block per unit set, without nesting them into each other', async () => {
    const out = await run(`.a{height:var(--x,1dvh);height:var(--x,2cqw)}`, cq);
    expect(out).toBe(
      `.a{height:var(--x,1vh);height:var(--x,2vw)}` +
        `@supports (height: 1dvh){.a{height:var(--x,1dvh);height:var(--x,2vw)}}` +
        `@supports (height: 1cqw){.a{height:var(--x,2cqw)}}`
    );
    expect(await run(out, cq)).toBe(out);
  });

  it('opens a new block when the unit set changes back, to keep source order', async () => {
    const out = await run(
      `.a{top:var(--x,1dvh);inset-block:var(--x,2cqw);inset:var(--x,3dvh);color:red}`,
      cq
    );
    expect(out).toBe(
      `.a{top:var(--x,1vh);inset-block:var(--x,2vw);inset:var(--x,3vh);color:red}` +
        `@supports (height: 1dvh){.a{top:var(--x,1dvh);inset-block:var(--x,2vw);inset:var(--x,3vh)}}` +
        `@supports (height: 1cqw){.a{inset-block:var(--x,2cqw);inset:var(--x,3vh)}}` +
        `@supports (height: 1dvh){.a{inset:var(--x,3dvh)}}`
    );
  });

  it('stays linear however many built-in units a rule mixes', async () => {
    const units = 'dvh svw lvmin dvw svh lvh dvmin svmin lvw dvmax svmax lvmax'.split(
      ' '
    );
    const css = `.a{${units.map((unit, i) => `height:var(--x,${i + 1}${unit})`).join(';')}}`;
    const out = await run(css);
    expect(out.match(/@supports/g)).toHaveLength(1);
    expect(out.match(/height:var/g)).toHaveLength(2 * units.length);
    expect(postcss.parse(out).toString()).toBe(out);
    expect(await run(out)).toBe(out);
  });

  it('shares one nested block between the declarations of a nested at-rule', async () => {
    const out = await run(`.a{@media all{height:var(--x,1dvh);height:var(--x,2dvh);}}`);
    expect(out).toBe(
      `.a{@media all{height:var(--x,1vh);height:var(--x,2vh);@supports (height: 1dvh){height:var(--x,1dvh);height:var(--x,2dvh);}}}`
    );
    expect(await run(out)).toBe(out);
  });

  it('keeps nested blocks linear in the number of declarations', async () => {
    const declarations = Array.from(
      { length: 32 },
      (_, i) => `height:var(--x,${i + 1}dvh);`
    );
    const out = await run(`.a{@media all{${declarations.join('')}}}`);
    expect(out.match(/@supports/g)).toHaveLength(1);
    expect(out.match(/height:var/g)).toHaveLength(64);
  });

  it('gives custom properties with the same unit one block, wherever they stand', async () => {
    const out = await run(`.a{--a:1dvh;--b:2cqw;--c:3svh}`, {
      includeCustomProps: true,
      ...cq,
    });
    expect(out).toBe(
      `.a{--a:1vh;--b:2vw;--c:3vh}` +
        `@supports (height: 1dvh){.a{--a:1dvh;--c:3svh}}` +
        `@supports (height: 1cqw){.a{--b:2cqw}}`
    );
  });
});

describe('declarations copied into an @supports block', () => {
  it('copies a declaration the plugin is told to skip as it is', async () => {
    const input = `.a { top: calc(1dvh + var(--a)); inset: calc(2svw + var(--b)); }`;
    const out = await run(input, { excludeProperties: 'inset' });
    expect(out).toBe(`.a { top: calc(1vh + var(--a)); inset: calc(2svw + var(--b)); }
@supports (height: 1dvh) { .a { top: calc(1dvh + var(--a)); inset: calc(2svw + var(--b)); } }`);
    expect(await run(out, { excludeProperties: 'inset' })).toBe(out);
  });

  it('does the same for a declaration switched off by a comment', async () => {
    const out = await run(
      `.a { top: calc(1dvh + var(--a)); /* postcss-viewport-fallback: off */ inset: calc(2dvh + var(--b)); }`
    );
    expect(out)
      .toBe(`.a { top: calc(1vh + var(--a)); /* postcss-viewport-fallback: off */ inset: calc(2dvh + var(--b)); }
@supports (height: 1dvh) { .a { top: calc(1dvh + var(--a)); inset: calc(2dvh + var(--b)); } }`);
    expect(await run(out)).toBe(out);
  });

  it('lets the copies of a declaration that cannot be guarded find their own fallback', async () => {
    const out = await run(
      `.a { margin: calc(20dvw - var(--k)); @media (min-width: 1px) { margin-top: 1px; } margin-top: calc(10cqw - var(--k)); }`,
      cq
    );
    expect(out).toBe(
      `.a { margin: calc(20vw - var(--k)); @supports (height: 1dvh) { margin: calc(20dvw - var(--k)); margin-top: calc(10vw - var(--k)); @supports (height: 1cqw) { margin-top: calc(10cqw - var(--k)); } } @media (min-width: 1px) { margin-top: 1px; } margin-top: calc(10cqw - var(--k)); }`
    );
    expect(await run(out, cq)).toBe(out);
  });

  it('leaves such a copy alone when the guard around it already proves its units', async () => {
    const out = await run(
      `.a { margin: calc(20dvw - var(--k)); @media (min-width: 1px) { margin-top: 1px; } margin-top: calc(10lvh - var(--k)); }`
    );
    expect(out).toBe(
      `.a { margin: calc(20vw - var(--k)); @supports (height: 1dvh) { margin: calc(20dvw - var(--k)); margin-top: calc(10lvh - var(--k)); } @media (min-width: 1px) { margin-top: 1px; } margin-top: calc(10lvh - var(--k)); }`
    );
    expect(await run(out)).toBe(out);
  });
});

describe('nested @supports blocks next to each other', () => {
  it('does not reach across a nested rule for a block to join', async () => {
    const out = await run(
      `.card { --a: 1dvh; & .x { color: red; } --b: 2dvh; & .n { --a: 0; --b: 0; } }`,
      { includeCustomProps: true }
    );
    expect(out).toBe(
      `.card { --a: 1vh; @supports (height: 1dvh) { --a: 1dvh; } & .x { color: red; } --b: 2vh; @supports (height: 1dvh) { --b: 2dvh; } & .n { --a: 0; --b: 0; } }`
    );
  });
});

describe('a range comment between a declaration and the ones copied after it', () => {
  it('keeps the copy of a switched-off declaration as its author wrote it', async () => {
    const out = await run(
      `.a { top: calc(1dvh + var(--a)); /* postcss-viewport-fallback: disable */ inset: calc(2cqw + var(--b)); }`,
      cq
    );
    expect(out)
      .toBe(`.a { top: calc(1vh + var(--a)); /* postcss-viewport-fallback: disable */ inset: calc(2cqw + var(--b)); }
@supports (height: 1dvh) { .a { top: calc(1dvh + var(--a)); /* postcss-viewport-fallback: off */ inset: calc(2cqw + var(--b)); } }`);
    expect(await run(out, cq)).toBe(out);
  });
});
