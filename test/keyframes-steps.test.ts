import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { Plugin } from 'postcss';
import plugin from '../src';
import type { TransformStats, ViewportFallbackOptions } from '../src';
import { run } from './helpers/run';

const chain = { customUnits: { cqh: 'dvh' } };

describe('@keyframes whose values climb a chain of units', () => {
  it('get one copy for every step, weakest first', async () => {
    const out = await run(
      `@keyframes k { to { top: var(--a, 1cqh); left: var(--b, 2dvw); } }`,
      chain
    );
    expect(out).toBe(
      `@keyframes k { to { top: var(--a, 1vh); left: var(--b, 2vw); } }\n` +
        `@supports (height: 1dvh) { @keyframes k { to { top: var(--a, 1dvh); left: var(--b, 2dvw); } } }\n` +
        `@supports (height: 1cqh) and (height: 1dvh) { @keyframes k { to { top: var(--a, 1cqh); left: var(--b, 2dvw); } } }`
    );
    expect(await run(out, chain)).toBe(out);
  });

  it('keep one copy when every value needs the same step', async () => {
    expect(
      await run(`@keyframes k { to { top: var(--a, 1dvh); left: var(--b, 2svw); } }`)
    ).toBe(
      `@keyframes k { to { top: var(--a, 1vh); left: var(--b, 2vw); } }\n` +
        `@supports (height: 1dvh) { @keyframes k { to { top: var(--a, 1dvh); left: var(--b, 2svw); } } }`
    );
  });

  it('lower a classic unit that customUnits maps further, step by step', async () => {
    const out = await run(`@keyframes k{to{top:var(--a,1svh)}}`, {
      customUnits: { vh: 'px' },
    });
    expect(out).toBe(
      `@keyframes k{to{top:var(--a,1px)}}` +
        `@supports (height: 1vh){@keyframes k{to{top:var(--a,1vh)}}}` +
        `@supports (height: 1dvh){@keyframes k{to{top:var(--a,1svh)}}}`
    );
  });

  it('keep the fallback of a value in the copies below its own first step', async () => {
    const out = await run(`@keyframes k{to{top:var(--a,1svh);left:var(--b,2dvw)}}`, {
      customUnits: { vh: 'px' },
    });
    expect(out).toBe(
      `@keyframes k{to{top:var(--a,1px);left:var(--b,2vw)}}` +
        `@supports (height: 1vh){@keyframes k{to{top:var(--a,1vh);left:var(--b,2vw)}}}` +
        `@supports (height: 1dvh){@keyframes k{to{top:var(--a,1svh);left:var(--b,2dvw)}}}`
    );
  });

  it('give a custom property its steps too', async () => {
    const out = await run(`@keyframes k{from{--h:0cqh}to{--h:9cqh;color:red}}`, {
      ...chain,
      includeCustomProps: true,
    });
    expect(out).toBe(
      `@keyframes k{from{--h:0vh}to{--h:9vh;color:red}}` +
        `@supports (height: 1dvh){@keyframes k{from{--h:0dvh}to{--h:9dvh;color:red}}}` +
        `@supports (height: 1cqh){@keyframes k{from{--h:0cqh}to{--h:9cqh;color:red}}}`
    );
  });

  const off = `/* postcss-viewport-fallback: disable */`;
  const on = `/* postcss-viewport-fallback: enable */`;

  it.each([
    [
      'in the same step',
      { customUnits: { cqh: 'cqb', cqb: 'vh' } },
      `@keyframes k{to{top:var(--a,1dvh);${off}left:var(--b,2cqh)}}`,
      `@keyframes k{to{top:var(--a,1vh);${off}left:var(--b,2cqh)}}` +
        `@supports (height: 1dvh){@keyframes k{to{top:var(--a,1dvh);${off}left:var(--b,2cqh)}}}`,
    ],
    [
      'in a later step',
      chain,
      `@keyframes k{from{left:var(--b,2dvw)}${off}to{top:var(--a,1cqh)}}`,
      `@keyframes k{from{left:var(--b,2vw)}${off}to{top:var(--a,1cqh)}}` +
        `@supports (height: 1dvh){@keyframes k{from{left:var(--b,2dvw)}${off}to{top:var(--a,1cqh)}}}`,
    ],
    [
      'between two steps that are not',
      chain,
      `@keyframes k{from{left:var(--b,2dvw)}${off}to{top:var(--a,1cqh)}${on}50%{width:var(--c,3cqh)}}`,
      `@keyframes k{from{left:var(--b,2vw)}${off}to{top:var(--a,1cqh)}${on}50%{width:var(--c,3vh)}}` +
        `@supports (height: 1dvh){@keyframes k{from{left:var(--b,2dvw)}${off}to{top:var(--a,1cqh)}${on}50%{width:var(--c,3dvh)}}}` +
        `@supports (height: 1cqh) and (height: 1dvh){@keyframes k{from{left:var(--b,2dvw)}${off}to{top:var(--a,1cqh)}${on}50%{width:var(--c,3cqh)}}}`,
    ],
  ])('leave alone a value switched off %s', async (_, options, input, expected) => {
    const out = await run(input, options);
    expect(out).toBe(expected);
    expect(await run(out, options)).toBe(out);
  });
});

describe('@keyframes that a later plugin changes', () => {
  async function outcome(css: string, options: ViewportFallbackOptions, later?: Plugin) {
    let stats: TransformStats | undefined;
    const ours = plugin({ ...options, onComplete: (final) => void (stats = final) });
    const result = await postcss(later ? [ours, later] : [ours]).process(css, {
      from: undefined,
    });
    return { css: result.css, stats: { ...stats, timeMs: 0 } };
  }

  const set = (from: string, to: string): Plugin => ({
    postcssPlugin: 'set',
    Declaration(decl) {
      if (decl.value === from) decl.value = to;
    },
  });

  it.each([
    [
      'the original of the last step',
      `@keyframes k{from{top:var(--a,1cqh)}to{top:var(--a,2cqh);left:3px}}`,
      set('var(--a,2cqh)', 'var(--a,5svw)'),
      `@keyframes k{from{top:var(--a,1cqh)}to{top:var(--a,5svw);left:3px}}`,
    ],
    [
      'the original into a value that needs no fallback',
      `@keyframes k{to{top:var(--a,2cqh);left:3px}}`,
      set('var(--a,2cqh)', '7px'),
      `@keyframes k{to{top:7px;left:3px}}`,
    ],
    [
      'a declaration without units',
      `@keyframes k{to{top:var(--a,2cqh);left:3px}}`,
      set('3px', '4px'),
      `@keyframes k{to{top:var(--a,2cqh);left:4px}}`,
    ],
    [
      'a declaration next to a plain twin, without any copy',
      `@keyframes k{to{height:100dvh;color:red}}`,
      set('red', 'blue'),
      `@keyframes k{to{height:100dvh;color:blue}}`,
    ],
    [
      'a plain declaration into a var() value',
      `@keyframes k{from{left:3px}to{top:var(--a,2cqh)}}`,
      set('3px', 'var(--b,4dvw)'),
      `@keyframes k{from{left:var(--b,4dvw)}to{top:var(--a,2cqh)}}`,
    ],
  ] as const)('follow %s', async (_, css, later, direct) => {
    expect(await outcome(css, chain, later)).toEqual(await outcome(direct, chain));
  });
});
