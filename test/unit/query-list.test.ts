import { describe, it, expect } from 'vitest';
import { normalizeQuery, splitQueries } from '../../src/core/queryList';

describe('splitQueries', () => {
  it('splits at the commas between queries only', () => {
    expect(splitQueries(`screen and (min-width: calc(1px, 2px)) , print`)).toEqual([
      `screen and (min-width: calc(1px, 2px))`,
      `print`,
    ]);
  });

  it('keeps the commas and parentheses of strings and comments', () => {
    expect(splitQueries(`(a: "b, (c"), (d)/* e, ( */and (f), (g: 'h),')`)).toEqual([
      `(a: "b, (c")`,
      `(d)/* e, ( */and (f)`,
      `(g: 'h),')`,
    ]);
  });

  it('takes an unterminated string or comment for the rest of the list', () => {
    expect(splitQueries(`(a), (b: "c, (d)`)).toEqual([`(a)`, `(b: "c, (d)`]);
    expect(splitQueries(`(a), (b) /* c, (d)`)).toEqual([`(a)`, `(b) /* c, (d)`]);
  });
});

describe('normalizeQuery', () => {
  it('ignores case and the spacing around punctuation', () => {
    expect(normalizeQuery(` ( MIN-WIDTH :  100VH )  and (width >= 1px) `)).toBe(
      `(min-width:100vh)and (width>=1px)`
    );
    expect(normalizeQuery(`(aspect-ratio > 16 / 9) , print`)).toBe(
      `(aspect-ratio>16/9),print`
    );
  });

  it('keeps the spaces that change the meaning', () => {
    expect(normalizeQuery(`(width > = 1px)`)).not.toBe(normalizeQuery(`(width >= 1px)`));
    expect(normalizeQuery(`(color)and(width)`)).not.toBe(
      normalizeQuery(`(color) and (width)`)
    );
    expect(normalizeQuery(`not (color)`)).toBe(`not (color)`);
  });

  it('drops comments and keeps the case of custom media names', () => {
    expect(normalizeQuery(`(--Tablet) AND /* wide */ (MIN-WIDTH:1PX)`)).toBe(
      `(--Tablet)and (min-width:1px)`
    );
  });
});
