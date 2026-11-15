import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createFootprint } from '../../src/core/properties';
import { ALIASES, LONGHANDS, SHORTHANDS } from '../../src/core/properties.data';
import { generate } from '../../scripts/properties.mjs';

function mayInteract(first: string, second: string): boolean {
  const footprint = createFootprint();
  footprint.add(first);
  return footprint.touches(second);
}

describe('two properties', () => {
  it.each([
    ['margin', 'margin-top'],
    ['margin-top', 'margin'],
    ['margin', 'margin-inline'],
    ['margin-left', 'margin-inline-start'],
    ['margin-block', 'margin-inline-end'],
    ['inset', 'top'],
    ['inset-block', 'left'],
    ['border', 'border-top-color'],
    ['border', 'border-image-source'],
    ['border-color', 'border-inline-start-color'],
    ['border-radius', 'border-start-start-radius'],
    ['font', 'line-height'],
    ['font', 'font-kerning'],
    ['font', 'font-variant-caps'],
    ['background', 'background-color'],
    ['flex', 'flex-basis'],
    ['grid-area', 'grid-row-start'],
    ['grid', 'grid-auto-flow'],
    ['overflow', 'overflow-x'],
    ['overflow-block', 'overflow-y'],
    ['height', 'block-size'],
    ['min-height', 'min-inline-size'],
    ['word-wrap', 'overflow-wrap'],
    ['-webkit-box-shadow', 'box-shadow'],
    ['-webkit-user-select', 'user-select'],
    ['-moz-user-select', 'user-select'],
    ['-moz-transition', 'transition-delay'],
    ['-ms-transform', 'transform'],
    ['page-break-after', 'break-after'],
    ['columns', 'column-wrap'],
    ['text-box', 'text-box-trim'],
    ['view-timeline', 'view-timeline-inset'],
    ['-webkit-margin-before', 'margin-top'],
    ['-webkit-box-flex', 'flex-grow'],
    ['-webkit-box-flex', 'flex'],
    ['-webkit-box-ordinal-group', 'order'],
    ['-webkit-box-orient', 'flex-flow'],
    ['-webkit-box-pack', 'justify-content'],
    ['-webkit-box-align', 'place-items'],
    ['glyph-orientation-vertical', 'text-orientation'],
    ['-webkit-border-image', 'border-top-width'],
    ['-webkit-border-image', 'border-width'],
    ['-webkit-border-image', 'border-image-source'],
    ['transition', 'transition-duration'],
    ['all', 'color'],
    ['HEIGHT', 'height'],
    ['Margin', 'MARGIN-TOP'],
  ])('%s and %s can meet', (first, second) => {
    expect(mayInteract(first, second)).toBe(true);
    expect(mayInteract(second, first)).toBe(true);
  });

  it.each([
    ['margin', 'padding'],
    ['margin-top', 'margin-left'],
    ['top', 'left'],
    ['height', 'width'],
    ['height', 'min-height'],
    ['min-height', 'max-height'],
    ['color', 'background'],
    ['border-top', 'border-left-color'],
    ['font', 'color'],
    ['display', 'height'],
    ['inset-block', 'margin-block'],
    ['transform', 'height'],
    ['padding-inline', 'margin-left'],
    ['-webkit-transition', 'height'],
    ['-moz-user-select', 'color'],
    ['column-count', 'column-gap'],
    ['border-image', 'border-top-width'],
  ])('%s and %s never meet', (first, second) => {
    expect(mayInteract(first, second)).toBe(false);
    expect(mayInteract(second, first)).toBe(false);
  });

  it.each([
    ['-moz-osx-font-smoothing', 'color'],
    ['height', 'some-future-property'],
    ['constructor', 'height'],
    ['toString', 'valueOf'],
  ])('an unknown property (%s, %s) is assumed to meet anything', (first, second) => {
    expect(mayInteract(first, second)).toBe(true);
    expect(mayInteract(second, first)).toBe(true);
  });

  it('takes a property for itself, known or not', () => {
    expect(mayInteract('height', 'height')).toBe(true);
    expect(mayInteract('-x-unknown', '-X-Unknown')).toBe(true);
  });

  it.each([
    ['margin', 'margin-trim'],
    ['overflow', 'overflow-anchor'],
  ])(
    '%s and %s meet by name alone, should the table miss a shorthand',
    (first, second) => {
      expect(mayInteract(first, second)).toBe(true);
      expect(mayInteract(second, first)).toBe(true);
    }
  );

  it('reads a name through its escapes', () => {
    expect(mayInteract('m\\61rgin', 'margin-top')).toBe(true);
    expect(mayInteract('m\\61rgin', 'padding')).toBe(false);
  });
});

describe('a footprint of several properties', () => {
  it('is touched by what meets any of them', () => {
    const footprint = createFootprint();
    footprint.add('margin-top');
    footprint.add('height');
    expect(footprint.touches('margin')).toBe(true);
    expect(footprint.touches('block-size')).toBe(true);
    expect(footprint.touches('margin-left')).toBe(false);
    expect(footprint.touches('width')).toBe(false);
  });

  it('grows with every property added to it', () => {
    const footprint = createFootprint();
    footprint.add('margin-top');
    expect(footprint.touches('margin-left')).toBe(false);
    footprint.add('margin');
    expect(footprint.touches('margin-left')).toBe(true);
  });

  it.each(['all', 'some-future-property'])(
    'is touched by everything once it holds %s',
    (prop) => {
      const footprint = createFootprint();
      footprint.add('height');
      expect(footprint.touches('color')).toBe(false);
      footprint.add(prop);
      expect(footprint.touches('color')).toBe(true);
    }
  );
});

describe('the property table', () => {
  it('connects every prefixed property it lists with the plain one', () => {
    const known = new Set([
      ...LONGHANDS.split(' '),
      ...Object.keys(SHORTHANDS),
      ...Object.keys(ALIASES),
    ]);
    const pairs = [...known]
      .map((name) => [name, name.replace(/^-(?:webkit|moz|ms|o)-/, '')])
      .filter(([name, plain]) => plain !== name && known.has(plain));
    expect(pairs.length).toBeGreaterThan(50);
    expect(pairs.filter(([name, plain]) => !mayInteract(name, plain))).toEqual([]);
  });

  it('is what the generator makes of the installed @webref/css', async () => {
    const committed = readFileSync(
      new URL('../../src/core/properties.data.ts', import.meta.url),
      'utf8'
    );
    expect(committed).toBe(await generate());
  });
});

describe('what Chrome itself makes of every shorthand and alias it knows', () => {
  const { browser, expansions } = JSON.parse(
    readFileSync(
      new URL('../../scripts/data/chrome-shorthands.json', import.meta.url),
      'utf8'
    )
  ) as { browser: string; expansions: Record<string, string[]> };

  it(`is never missed: a property meets each longhand ${browser} sets through it`, () => {
    const missed = Object.entries(expansions).flatMap(([name, longhands]) =>
      longhands
        .filter((longhand) => !mayInteract(name, longhand))
        .map((longhand) => `${name} → ${longhand}`)
    );
    expect(missed).toEqual([]);
  });

  it('covers a few hundred properties, so the comparison means something', () => {
    expect(Object.keys(expansions).length).toBeGreaterThan(200);
  });
});
