import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../../src';
import { run } from '../helpers/run';

describe('a classic unit that customUnits lowers further', () => {
  const lowered = { customUnits: { vh: 'px' } };

  it('upgrades the seed step by step, weakest block first', async () => {
    const out = await run(`.a{height:calc(1dvw + 1svh + var(--x,0px))}`, {
      strategy: 'css-var',
      ...lowered,
    });
    expect(out).toContain(`:root, :host { --pvf-dvw: 1vw; --pvf-svh: 1px }
@supports (height: 1vh) { :root, :host { --pvf-svh: 1vh } }
@supports (height: 1dvh) { :root, :host { --pvf-dvw: 1dvw; --pvf-svh: 1svh } }`);
  });

  it('keeps the blocks of custom properties in the same order', async () => {
    const out = await run(`.a{--a:1dvw;--b:1svh}`, {
      includeCustomProps: true,
      ...lowered,
    });
    expect(out).toBe(
      `.a{--a:1vw;--b:1px}` +
        `@supports (height: 1vh){.a{--b:1vh}}` +
        `@supports (height: 1dvh){.a{--a:1dvw;--b:1svh}}`
    );
    expect(await run(out, { includeCustomProps: true, ...lowered })).toBe(out);
  });

  it('orders the blocks of custom properties that climb different ladders', async () => {
    const options = { includeCustomProps: true, ...lowered };
    const out = await run(`.a{--a:1dvw;--c:1vh;--b:1svh}`, options);
    expect(out).toBe(
      `.a{--a:1vw;--c:1px;--b:1px}` +
        `@supports (height: 1vh){.a{--c:1vh;--b:1vh}}` +
        `@supports (height: 1dvh){.a{--a:1dvw;--b:1svh}}`
    );
    expect(await run(out, options)).toBe(out);
  });

  it('puts a unit that falls back to a built-in one after their shared block', async () => {
    const options = { customUnits: { cqw: 'dvw', vh: 'lh', lh: 'px' } };
    expect(await run(`.a{width:1cqw;height:1svh}`, { strategy: 'css-var', ...options }))
      .toContain(`:root, :host { --pvf-cqw: 1vw; --pvf-svh: 1px }
@supports (height: 1lh) { :root, :host { --pvf-svh: 1lh } }
@supports (height: 1vh) { :root, :host { --pvf-svh: 1vh } }
@supports (height: 1dvh) { :root, :host { --pvf-cqw: 1dvw; --pvf-svh: 1svh } }
@supports (height: 1cqw) { :root, :host { --pvf-cqw: 1cqw } }`);
    expect(
      await run(`.a{--a:1cqw;--b:1svh}`, { includeCustomProps: true, ...options })
    ).toBe(
      `.a{--a:1vw;--b:1px}` +
        `@supports (height: 1lh){.a{--b:1lh}}` +
        `@supports (height: 1vh){.a{--b:1vh}}` +
        `@supports (height: 1dvh){.a{--a:1dvw;--b:1svh}}` +
        `@supports (height: 1cqw){.a{--a:1cqw}}`
    );
  });

  it('raises a redefined built-in unit above the block it falls back to', async () => {
    const out = await run(`.a{width:1dvw;height:1dvh}`, {
      strategy: 'css-var',
      customUnits: { dvw: 'svw', vh: 'lh', lh: 'px' },
    });
    expect(out).toContain(`:root, :host { --pvf-dvh: 1px; --pvf-dvw: 1vw }
@supports (height: 1lh) { :root, :host { --pvf-dvh: 1lh } }
@supports (height: 1vh) { :root, :host { --pvf-dvh: 1vh } }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh; --pvf-dvw: 1svw } }
@supports (height: 1dvw) { :root, :host { --pvf-dvw: 1dvw } }`);
  });

  it('rejects a mapping that leads back to the built-in units', () => {
    expect(() => plugin({ customUnits: { vmin: 'dvw' } })).toThrow(
      /customUnits: the fallback chain of "dvmin" returns to the built-in viewport units \(dvmin → vmin → dvw → vw\)/
    );
  });

  it('rejects it even when the targets need no built-in fallbacks', () => {
    expect(() =>
      plugin({ customUnits: { vmin: 'dvw' }, browserslist: 'last 1 chrome version' })
    ).toThrow(/returns to the built-in viewport units/);
  });
});

describe('repeated keyframes in a minified stylesheet', () => {
  it('stand right after the original, without a line break', async () => {
    const out = await run(`@keyframes a{to{height:var(--x,1dvh)}}.b{color:red}`);
    expect(out).toBe(
      `@keyframes a{to{height:var(--x,1vh)}}` +
        `@supports (height: 1dvh){@keyframes a{to{height:var(--x,1dvh)}}}.b{color:red}`
    );
    expect(await run(`@media print{@keyframes a{to{height:var(--x,1dvh)}}}`)).toBe(
      `@media print{@keyframes a{to{height:var(--x,1vh)}}` +
        `@supports (height: 1dvh){@keyframes a{to{height:var(--x,1dvh)}}}}`
    );
  });
});

describe('media query lists with strings and comments', () => {
  it.each([
    [
      `@media (unknown: ")"),(min-width:1dvh){a{color:red}}`,
      `@media (unknown: ")"),(min-width:1vh),(min-width:1dvh){a{color:red}}`,
    ],
    [
      `@media (unknown: '(,'),(min-width:1dvh){a{color:red}}`,
      `@media (unknown: '(,'),(min-width:1vh),(min-width:1dvh){a{color:red}}`,
    ],
  ])('does not split %s inside the string', async (input, expected) => {
    const out = await run(input);
    expect(out).toBe(expected);
    expect(await run(out)).toBe(out);
  });

  it('does not split inside a comment', async () => {
    const out = await run(`@media (min-width:1dvh)/* a, ( */and (color){a{color:red}}`);
    expect(out).toBe(
      `@media (min-width:1vh)/* a, ( */and (color), (min-width:1dvh)/* a, ( */and (color){a{color:red}}`
    );
    expect(await run(out)).toBe(out);
  });
});

describe('browserslist: true for a stylesheet that was parsed elsewhere', () => {
  it('uses the file the syntax tree came from', async () => {
    const file = resolve(import.meta.dirname, '../fixtures/browserslist/modern/a.css');
    const input = `.a { height: 100dvh; }`;
    const root = postcss.parse(input, { from: file });
    const result = await postcss([plugin({ browserslist: true })]).process(root, {
      from: undefined,
    });
    expect(result.css).toBe(input);
  });
});
