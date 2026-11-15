import { describe, it, expect } from 'vitest';
import { run } from '../helpers/run';

describe('comments in a prelude the plugin rewrites', () => {
  it.each([
    [
      `@media (min-height: 100dvh) /* tall */ and (color) { a { b: c } }`,
      `@media (min-height: 100vh) /* tall */ and (color), (min-height: 100dvh) /* tall */ and (color) { a { b: c } }`,
    ],
    [
      `@import url("a.css") /* tall */ (min-height: 100dvh);`,
      `@import url("a.css") /* tall */ (min-height: 100vh), (min-height: 100dvh);`,
    ],
    [
      `@custom-media --tall /* why */ (min-height: 100dvh);`,
      `@custom-media --tall /* why */ (min-height: 100vh), (min-height: 100dvh);`,
    ],
  ])('stay where the author put them: %s', async (input, expected) => {
    const out = await run(input);
    expect(out).toBe(expected);
    expect(await run(out)).toBe(out);
  });
});

describe('a fallback chain as long as the rewrite limit', () => {
  const units = Array.from(
    { length: 100 },
    (_, i) =>
      `u${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`
  );
  const customUnits = Object.fromEntries(
    units.map((unit, i) => [unit, units[i + 1] ?? 'px'])
  );

  it('is lowered to the end inside the block of another declaration too', async () => {
    const out = await run(`.a{height:var(--x,1dvh);block-size:1uaa}`, { customUnits });
    expect(out).toContain('block-size:1px;');
    expect(out).toContain(
      '@supports (height: 1dvh){.a{height:var(--x,1dvh);block-size:1px;'
    );
  });
});

describe('queries that differ in spacing that matters', () => {
  it.each([
    [
      `@media (width > = 100vh),(width >= 100dvh){a{color:red}}`,
      `@media (width > = 100vh),(width >= 100vh),(width >= 100dvh){a{color:red}}`,
    ],
    [
      `@media (color)and(width>=100vh),(color) and /*c*/ (width>=100dvh){a{color:red}}`,
      `@media (color)and(width>=100vh),(color) and /*c*/ (width>=100vh),(color) and /*c*/ (width>=100dvh){a{color:red}}`,
    ],
  ])('are not taken for the fallback: %s', async (input, expected) => {
    const out = await run(input);
    expect(out).toBe(expected);
    expect(await run(out)).toBe(out);
  });

  it('are still the same query when the spacing means nothing', async () => {
    const input = `@media ( min-height : 50vh ) and (width>=1px), (min-height:50dvh)and (width >= 1px){a{color:red}}`;
    expect(await run(input)).toBe(input);
  });
});
