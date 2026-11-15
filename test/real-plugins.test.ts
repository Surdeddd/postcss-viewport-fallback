import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { AcceptedPlugin } from 'postcss';
import logical from 'postcss-logical';
import nesting from 'postcss-nesting';
import plugin from '../src';
import type { ViewportFallbackOptions } from '../src';

const sheets: Array<[string, string]> = [
  ['a plain value', `.a{block-size:100dvh}`],
  ['a value with var()', `.a{block-size:calc(100dvh - var(--header))}`],
  [
    'plain values next to a shorthand with var()',
    `.a{min-block-size:100svh;inline-size:50dvw;margin-block:var(--gap,1dvh) 2dvh}`,
  ],
  ['a shorthand that becomes two declarations', `.a{inset-block:var(--t,10dvh) 0}`],
  [
    'a value with var() that another declaration follows',
    `.a{block-size:var(--x,1dvh);block-size:5px;color:red}`,
  ],
  [
    'a value with var() before a nested rule',
    `.a{block-size:var(--x,1dvh);&:hover{block-size:50dvh}}`,
  ],
  [
    'a value with var() after a nested rule',
    `.a{&:hover{height:var(--y,2dvh)}height:var(--x,1dvh)}`,
  ],
  [
    'a media query around a value with var()',
    `@media (min-height: 50dvh){.a{block-size:var(--x,1dvh)}}`,
  ],
  ['keyframes with var()', `@keyframes k{to{block-size:var(--x,1dvh)}}`],
  ['a custom property', `.a{--size:100dvh;block-size:var(--size)}`],
];

const pipelines: Array<[string, () => AcceptedPlugin[]]> = [
  ['postcss-logical', () => [logical()]],
  ['postcss-nesting', () => [nesting()]],
  ['postcss-nesting and postcss-logical', () => [nesting(), logical()]],
];

const settings: Array<[string, ViewportFallbackOptions]> = [
  ['default options', {}],
  ['custom properties included', { includeCustomProps: true }],
  ['the css-var strategy', { strategy: 'css-var' }],
  ['preserve: false', { preserve: false }],
];

async function run(plugins: AcceptedPlugin[], css: string): Promise<string> {
  return (await postcss(plugins).process(css, { from: undefined })).css;
}

const unitsOf = (css: string): string[] => css.match(/[\d.]+[dsl]v[hw]/g) ?? [];

describe.each(pipelines)('in a pipeline with %s', (_, others) => {
  describe.each(settings)('with %s', (__, options) => {
    it.each(sheets)('%s comes out the same before and after it', async (___, css) => {
      const before = await run([plugin(options), ...others()], css);
      const after = await run([...others(), plugin(options)], css);
      expect(before).toBe(after);
    });
  });

  it.each(sheets)('%s keeps every unit the author wrote', async (__, css) => {
    const output = await run([plugin(), ...others()], css);
    for (const unit of unitsOf(css)) expect(output).toContain(unit);
  });
});
