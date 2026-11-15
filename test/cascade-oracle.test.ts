import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { ViewportFallbackOptions } from '../src';
import { process } from './helpers/run';

type UnitMap = Record<string, string>;
type Supported = (unit: string) => boolean;

/** The physical sides that the start and the end of each axis fall on. */
interface Flow {
  block: [string, string];
  inline: [string, string];
}

interface Browser {
  map: UnitMap;
  supported: Supported;
  /** Older nesting implementations apply a rule's own declarations before all of its nested blocks. */
  hoists: boolean;
  /** The writing mode of the element; horizontal and left to right when not given. */
  flow?: Flow;
}

const BUILT_IN: UnitMap = {};
for (const variant of ['d', 's', 'l']) {
  for (const unit of ['vw', 'vh', 'vmin', 'vmax']) BUILT_IN[variant + unit] = unit;
}
const CHAIN: UnitMap = { ...BUILT_IN, cqh: 'svh' };

const DIMENSION = /(?<![\w.#-])([-+]?(?:\d*\.)?\d+)([a-z]+)(?![\w-])/gi;
const SUBSTITUTION = /\bvar\(/;
const INVALID = '<invalid at computed-value time>';

const HORIZONTAL: Flow = { block: ['top', 'bottom'], inline: ['left', 'right'] };
const FLOWS: Record<string, Flow> = {
  'horizontal-tb': HORIZONTAL,
  'horizontal-tb, right to left': { block: ['top', 'bottom'], inline: ['right', 'left'] },
  'vertical-rl': { block: ['right', 'left'], inline: ['top', 'bottom'] },
  'vertical-lr': { block: ['left', 'right'], inline: ['top', 'bottom'] },
};
const SIDES = ['top', 'right', 'bottom', 'left'];
const BOX = /^(margin|padding|inset)(?:-(.+))?$/;
const BORDER =
  /^border(?:-(top|right|bottom|left|block|inline)(?:-(start|end))?)?(?:-(width|style|color))?$/;
const SIZE = /^(min-|max-)?(block|inline)-size$/;
const PARTS: Record<string, string[]> = {
  gap: ['row-gap', 'column-gap'],
  'grid-gap': ['row-gap', 'column-gap'],
  'grid-row-gap': ['row-gap'],
  font: ['font-size', 'line-height', 'font-family', 'font-weight'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
};

/** The sides that `block`, `inline-start` or `top` name in a writing mode; all four for none. */
function sidesOf(where: string | undefined, flow: Flow): string[] {
  if (!where) return SIDES;
  const [axis, edge] = where.split('-');
  if (axis !== 'block' && axis !== 'inline') return [axis];
  const [start, end] = flow[axis];
  return edge === 'start' ? [start] : edge === 'end' ? [end] : [start, end];
}

/**
 * The physical longhands a property sets in a writing mode. Written by hand, apart from the
 * table the plugin ships: the two have to agree on which declarations can meet.
 */
function longhandsOf(prop: string, flow: Flow): string[] {
  const box = BOX.exec(prop);
  if (box) {
    return sidesOf(box[2], flow).map((side) =>
      box[1] === 'inset' ? side : `${box[1]}-${side}`
    );
  }
  const border = BORDER.exec(prop);
  if (border) {
    const where = border[1] && border[2] ? `${border[1]}-${border[2]}` : border[1];
    const aspects = border[3] ? [border[3]] : ['width', 'style', 'color'];
    const sides = sidesOf(where, flow).flatMap((side) =>
      aspects.map((aspect) => `border-${side}-${aspect}`)
    );
    return prop === 'border' ? [...sides, 'border-image'] : sides;
  }
  const size = SIZE.exec(prop);
  if (size) {
    const upright = flow[size[2] as 'block' | 'inline'][0] === 'top';
    return [`${size[1] ?? ''}${upright ? 'height' : 'width'}`];
  }
  return PARTS[prop] ?? [prop];
}

function mappedUnits(value: string, map: UnitMap): string[] {
  return [...value.matchAll(DIMENSION)]
    .map((match) => match[2].toLowerCase())
    .filter((unit) => unit in map);
}

function lowerOnce(value: string, map: UnitMap): string {
  return value.replace(DIMENSION, (match, number: string, unit: string) =>
    unit.toLowerCase() in map ? number + map[unit.toLowerCase()] : match
  );
}

function ladder(value: string, map: UnitMap): string[] {
  const steps = [value];
  while (mappedUnits(steps[steps.length - 1], map).length > 0) {
    steps.push(lowerOnce(steps[steps.length - 1], map));
  }
  return steps;
}

function supportsHolds(params: string, { map, supported }: Browser): boolean {
  return params.split(/\s+and\s+/i).every((term) => {
    const negated = /^not\s/i.test(term.trim());
    const test = term.trim().replace(/^not\s+/i, '');
    const holds = /^\(\s*--/.test(test) || mappedUnits(test, map).every(supported);
    return negated ? !holds : holds;
  });
}

/** Every longhand `all` resets here: the ones the properties of these stylesheets can set. */
const everything = new Set<string>();

function inCascadeOrder(
  container: postcss.Container,
  hoists: boolean
): postcss.Declaration[] {
  const own: postcss.Declaration[] = [];
  const nested: postcss.Declaration[] = [];
  container.each((child) => {
    if (child.type === 'decl') own.push(child);
    else if (child.type === 'rule' || child.type === 'atrule') {
      (hoists ? nested : own).push(...inCascadeOrder(child, hoists));
    }
  });
  return [...own, ...nested];
}

function placeOf(decl: postcss.Declaration, browser: Browser) {
  const selectors: string[] = [];
  let applies = true;
  let layered = false;
  for (
    let parent = decl.parent;
    parent && parent.type !== 'root';
    parent = parent.parent
  ) {
    if (parent.type === 'rule') selectors.unshift((parent as postcss.Rule).selector);
    if (parent.type !== 'atrule') continue;
    const atRule = parent as postcss.AtRule;
    if (atRule.name === 'layer') layered = true;
    if (atRule.name === 'supports' && !supportsHolds(atRule.params, browser))
      applies = false;
  }
  return { selector: selectors.join(' >> '), applies, layered };
}

function keysOf(decl: postcss.Declaration, selector: string, flow: Flow): string[] {
  const longhands = decl.prop === 'all' ? [...everything] : longhandsOf(decl.prop, flow);
  return longhands.map((prop) => `${selector}|${prop}`);
}

/** The value a browser ends up with per `selector|longhand`, by cascade order, importance and layers. */
function winners(
  css: string | postcss.Root,
  browser: Browser,
  dropsInvalid: boolean
): Map<string, string> {
  const sheet = typeof css === 'string' ? postcss.parse(css) : css;
  const flow = browser.flow ?? HORIZONTAL;
  const best = new Map<string, { rank: number; value: string }>();
  for (const decl of inCascadeOrder(sheet, browser.hoists)) {
    const { selector, applies, layered } = placeOf(decl, browser);
    if (!applies || !selector) continue;

    const isCustom = decl.prop.startsWith('--');
    const usable =
      !dropsInvalid ||
      isCustom ||
      mappedUnits(decl.value, browser.map).every(browser.supported);
    if (!usable && !SUBSTITUTION.test(decl.value)) continue;

    const rank = decl.important ? (layered ? 3 : 2) : layered ? 0 : 1;
    for (const key of keysOf(decl, selector, flow)) {
      const current = best.get(key);
      if (!current || rank >= current.rank) {
        best.set(key, { rank, value: usable ? decl.value.trim() : INVALID });
      }
    }
  }
  return new Map([...best].map(([key, winner]) => [key, winner.value]));
}

interface Shape {
  dims: string[];
  props: string[];
  guards: boolean;
  /** Repeated regular properties, a shorthand next to its longhand and values with var(). */
  rich: boolean;
  nesting: boolean;
}

function generator(seed: number, { dims, props, guards, rich, nesting }: Shape) {
  let state = seed;
  const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

  const value = () => {
    const roll = random();
    if (rich && roll < 0.2) return `calc(${pick(dims)} - var(--k))`;
    if (rich && roll < 0.3) return `var(--k, ${pick(dims)})`;
    return roll < 0.55 ? `calc(${pick(dims)} - ${pick(dims)})` : pick(dims);
  };
  const block = (depth: number): string => {
    const items: string[] = [];
    const regularUsed = new Set<string>();
    for (let i = 0, count = 1 + Math.floor(random() * 5); i < count; i++) {
      const roll = nesting && depth < 2 ? random() : 1;
      if (roll < 0.15) {
        items.push(`& .n { ${block(depth + 1)} }`);
        continue;
      }
      if (roll < 0.3) {
        items.push(`@media (min-width: 1px) { ${block(depth + 1)} }`);
        continue;
      }
      const isCustom = random() < (rich ? 0.25 : 0.6);
      const prop = isCustom ? pick(['--x', '--y']) : pick(props);
      if (!rich && !isCustom && regularUsed.has(prop)) continue;
      regularUsed.add(prop);
      items.push(`${prop}: ${value()}${random() < 0.15 ? ' !important' : ''};`);
    }
    return items.join(' ') || 'color: red;';
  };
  const rule = () => `${pick(['.a', '.b', ':root'])} { ${block(0)} }`;
  const wrappers = [
    (body: string) => body,
    (body: string) => body,
    (body: string) => `@media (min-width: 1px) { ${body} }`,
    (body: string) => `@supports not (height: 1dvh) { ${body} }`,
    (body: string) => `@supports (display: grid) { ${body} }`,
    (body: string) => `@supports (--probe: 1dvh) { ${body} }`,
    (body: string) => `@layer base { ${body} }`,
    ...(guards
      ? [
          (body: string) => `@supports (height: 1dvh) { ${body} }`,
          (body: string) => `@supports (height: 100svh) and (display: grid) { ${body} }`,
        ]
      : []),
  ];

  return () =>
    Array.from({ length: 1 + Math.floor(random() * 5) }, () =>
      pick(wrappers)(Array.from({ length: 1 + Math.floor(random() * 2) }, rule).join(' '))
    ).join('\n');
}

const BASE_DIMS = [
  '100dvh',
  '50svh',
  '10lvh',
  '20dvw',
  '5svmin',
  '12px',
  '3rem',
  '40%',
  '100vh',
  '50vh',
  '20vw',
  '100dvh',
];
const RICH_DIMS = [
  '100dvh',
  '50svh',
  '10lvh',
  '20dvw',
  '5svmin',
  '12px',
  '3rem',
  '40%',
  '7vh',
];
const FEW_DIMS = ['100dvh', '50svh', '12px'];
const CHAIN_DIMS = ['100cqh', '30cqh'];

const SUPPORT: Record<string, Supported> = {
  'supports every unit': () => true,
  'lacks only the custom unit': (unit) => unit !== 'cqh',
  'supports only the custom unit': (unit) => unit === 'cqh',
  'supports no mapped unit': () => false,
};

describe('the oracle itself', () => {
  const legacy: Browser = { map: BUILT_IN, supported: () => false, hoists: false };

  it('drops what a browser cannot parse and falls back to the previous declaration', () => {
    const css = `.a { height: 1px; height: 100dvh; }`;
    expect(winners(css, legacy, true).get('.a|height')).toBe('1px');
    expect(winners(css, legacy, false).get('.a|height')).toBe('100dvh');
  });

  it('knows that var() keeps an unsupported value alive until it is too late', () => {
    const css = `.a { height: 1px; height: calc(100dvh - var(--k)); }`;
    expect(winners(css, legacy, true).get('.a|height')).toBe(INVALID);
  });

  it('applies a shorthand to its longhand', () => {
    const css = `.a { margin-top: 1px; margin: 2px; }`;
    expect(winners(css, legacy, true).get('.a|margin-top')).toBe('2px');
  });

  it('keeps apart what cannot meet', () => {
    const css = `.a { margin-top: 1px; margin-left: 2px; border-top: 3px; border-color: 4px; }`;
    const result = winners(css, legacy, true);
    expect(result.get('.a|margin-top')).toBe('1px');
    expect(result.get('.a|border-top-width')).toBe('3px');
    expect(result.get('.a|border-top-color')).toBe('4px');
  });

  it('places a flow-relative property by the writing mode', () => {
    const css = `.a { top: 1px; left: 2px; inset-block-start: 3px; height: 4px; inline-size: 5px; }`;
    const upright = winners(css, legacy, true);
    expect(upright.get('.a|top')).toBe('3px');
    expect(upright.get('.a|left')).toBe('2px');
    expect(upright.get('.a|height')).toBe('4px');

    const sideways = winners(css, { ...legacy, flow: FLOWS['vertical-lr'] }, true);
    expect(sideways.get('.a|top')).toBe('1px');
    expect(sideways.get('.a|left')).toBe('3px');
    expect(sideways.get('.a|height')).toBe('5px');
  });

  it('resets every other property with `all`, custom properties aside', () => {
    everything.add('height');
    const css = `.a { height: 1px; --x: 2px; all: 3px; }`;
    const result = winners(css, legacy, true);
    expect(result.get('.a|height')).toBe('3px');
    expect(result.get('.a|--x')).toBe('2px');
  });

  it('orders nested blocks the way each generation of browsers does', () => {
    const css = `.a { @media (min-width: 1px) { height: 1px; } height: 2px; }`;
    expect(winners(css, legacy, true).get('.a|height')).toBe('2px');
    expect(winners(css, { ...legacy, hoists: true }, true).get('.a|height')).toBe('1px');
  });

  it('evaluates @supports for the browser at hand', () => {
    const css = `.a { height: 1px; } @supports (height: 1dvh) { .a { height: 100dvh; } }`;
    expect(winners(css, legacy, true).get('.a|height')).toBe('1px');
    expect(
      winners(css, { ...legacy, supported: () => true }, true).get('.a|height')
    ).toBe('100dvh');
  });
});

interface Scenario {
  name: string;
  opts: ViewportFallbackOptions;
  map: UnitMap;
  shape: Omit<Shape, 'guards'>;
  /** Check the result in every writing mode: the stylesheet has flow-relative properties. */
  flows?: boolean;
}

const flat = { props: ['height', 'width', 'margin'], rich: false, nesting: false };
const rich = { props: ['height', 'margin', 'margin-top'], rich: true, nesting: false };
const nested = { ...rich, nesting: true };
const customProps = { includeCustomProps: true };
const chain = { customUnits: { cqh: 'svh' } };

const FAMILIES: Record<string, string[]> = {
  'margins and paddings': [
    'margin',
    'margin-top',
    'margin-left',
    'margin-block',
    'margin-inline-start',
    'padding',
    'padding-top',
    'color',
  ],
  'insets and sizes': [
    'inset',
    'top',
    'left',
    'inset-inline',
    'inset-block-end',
    'height',
    'width',
    'block-size',
    'min-inline-size',
    'min-height',
  ],
  borders: [
    'border',
    'border-width',
    'border-top',
    'border-top-width',
    'border-color',
    'border-inline-width',
    'border-block-start',
    'outline-width',
  ],
  'unrelated shorthands and `all`': [
    'all',
    'gap',
    'row-gap',
    'grid-gap',
    'font',
    'font-size',
    'line-height',
    'flex',
    'flex-basis',
    'margin',
    'margin-top',
    'color',
  ],
};
for (const props of Object.values(FAMILIES)) {
  for (const prop of props) {
    if (prop === 'all') continue;
    for (const flow of Object.values(FLOWS)) {
      for (const longhand of longhandsOf(prop, flow)) everything.add(longhand);
    }
  }
}

const familyScenarios = Object.entries(FAMILIES).flatMap(([name, props]): Scenario[] => [
  {
    name: `shorthand families: ${name}`,
    opts: {},
    map: BUILT_IN,
    shape: { dims: RICH_DIMS, props, rich: true, nesting: true },
    flows: true,
  },
  {
    name: `shorthand families with a chain: ${name}`,
    opts: { ...customProps, ...chain },
    map: CHAIN,
    shape: { dims: [...RICH_DIMS, ...CHAIN_DIMS], props, rich: true, nesting: true },
    flows: true,
  },
]);

const scenarios: Scenario[] = [
  {
    name: 'default options',
    opts: {},
    map: BUILT_IN,
    shape: { dims: BASE_DIMS, ...flat },
  },
  {
    name: 'includeCustomProps',
    opts: customProps,
    map: BUILT_IN,
    shape: { dims: BASE_DIMS, ...flat },
  },
  {
    name: 'includeCustomProps with a customUnits chain',
    opts: { ...customProps, ...chain },
    map: CHAIN,
    shape: { dims: [...BASE_DIMS, ...CHAIN_DIMS], ...flat },
  },
  {
    name: 'includeCustomProps with preserve: false',
    opts: { ...customProps, preserve: false },
    map: BUILT_IN,
    shape: { dims: BASE_DIMS, ...flat },
  },
  {
    name: 'repeated properties, shorthands and var()',
    opts: {},
    map: BUILT_IN,
    shape: { dims: RICH_DIMS, ...rich },
  },
  {
    name: 'repeated properties, shorthands and var() with includeCustomProps and a chain',
    opts: { ...customProps, ...chain },
    map: CHAIN,
    shape: { dims: [...RICH_DIMS, ...CHAIN_DIMS], ...rich },
  },
  {
    name: 'repeated properties, shorthands and var() with preserve: false',
    opts: { ...customProps, preserve: false },
    map: BUILT_IN,
    shape: { dims: RICH_DIMS, ...rich },
  },
  {
    name: 'few distinct values, so that declarations repeat each other',
    opts: {},
    map: BUILT_IN,
    shape: { dims: FEW_DIMS, ...rich, props: ['height'] },
  },
  {
    name: 'few distinct values that climb different ladders',
    opts: chain,
    map: CHAIN,
    shape: { dims: ['100dvh', '30cqh', '12px'], ...rich, props: ['height'] },
  },
  {
    name: 'few distinct values with preserve: false',
    opts: { preserve: false },
    map: BUILT_IN,
    shape: { dims: FEW_DIMS, ...rich, props: ['margin', 'margin-top'] },
  },
  {
    name: 'nested rules',
    opts: {},
    map: BUILT_IN,
    shape: { dims: RICH_DIMS, ...nested },
  },
  {
    name: 'nested rules with includeCustomProps and a chain',
    opts: { ...customProps, ...chain },
    map: CHAIN,
    shape: { dims: [...RICH_DIMS, ...CHAIN_DIMS], ...nested },
  },
  ...familyScenarios,
];

describe('cascade oracle: every browser ends up with the intended value', () => {
  it.each(scenarios)('$name', async ({ opts, map, shape, flows }) => {
    const sheet = generator(20261114, { ...shape, guards: opts.preserve !== false });

    for (let round = 0; round < 150; round++) {
      const input = sheet();
      const result = await process(input, opts);
      const output = result.css;
      expect(
        (await process(output, opts)).css,
        `second run changed the output of:\n${input}`
      ).toBe(output);

      const before = postcss.parse(input);
      const after = postcss.parse(output);
      for (const [mode, flow] of Object.entries(flows ? FLOWS : { '': HORIZONTAL })) {
        const unguardable = new Set<string>();
        for (const { node } of result.warnings()) {
          const decl = node as postcss.Declaration;
          const { selector } = placeOf(decl, {
            map,
            supported: () => true,
            hoists: false,
          });
          for (const key of keysOf(decl, selector, flow)) unguardable.add(key);
        }

        for (const hoists of shape.nesting ? [false, true] : [false]) {
          for (const [name, supported] of Object.entries(SUPPORT)) {
            const browser: Browser = { map, supported, hoists, flow };
            const intended = winners(before, browser, false);
            const untouched = winners(before, browser, true);
            const actual = winners(after, browser, true);

            for (const [key, value] of intended) {
              const steps = ladder(value, map);
              const leftAlone = key.includes('|--') && !opts.includeCustomProps;
              const expected = leftAlone
                ? value
                : opts.preserve === false
                  ? steps[steps.length - 1]
                  : steps.find((step) => mappedUnits(step, map).every(supported));
              const accepted =
                unguardable.has(key) && actual.get(key) === untouched.get(key)
                  ? untouched.get(key)
                  : expected;
              expect(
                actual.get(key),
                `${key} in a browser that ${name}${hoists ? ' and hoists declarations' : ''}${mode && ` (${mode})`}\ninput:\n${input}\noutput:\n${output}`
              ).toBe(accepted);
            }
          }
        }
      }
    }
  });
});

const PVF_PRODUCT = /calc\(var\(--pvf-([a-z]+), 1([a-z%]+)\) \* ([^)]+)\)/g;

function lowerUntilSupported(unit: string, map: UnitMap, supported: Supported): string {
  let current = unit;
  while (current in map && !supported(current)) current = map[current];
  return current;
}

describe('cascade oracle: css-var resolves to the best unit each browser supports', () => {
  it.each([
    { name: 'built-in units', customUnits: undefined, map: BUILT_IN, extra: [] },
    {
      name: 'customUnits chain',
      customUnits: { cqh: 'svh' },
      map: CHAIN,
      extra: CHAIN_DIMS,
    },
  ])('$name', async ({ customUnits, map, extra }) => {
    for (const preserve of [true, false]) {
      for (const shape of [
        { dims: [...BASE_DIMS, ...extra], ...flat },
        { dims: [...RICH_DIMS, ...extra], ...rich },
      ]) {
        const opts: ViewportFallbackOptions = {
          strategy: 'css-var',
          includeCustomProps: true,
          preserve,
          ...(customUnits && { customUnits }),
        };
        const sheet = generator(141126, { ...shape, guards: true });

        for (let round = 0; round < 80; round++) {
          const input = sheet();
          const output = (await process(input, opts)).css;
          expect(
            (await process(output, opts)).css,
            `second run changed the output of:\n${input}`
          ).toBe(output);

          for (const [name, supported] of Object.entries(SUPPORT)) {
            const browser: Browser = { map, supported, hoists: false };
            const intended = winners(input, browser, false);
            const actual = winners(output, browser, true);
            const seeded = (unit: string, terminal: string) =>
              actual.get(`:root, :host|--pvf-${unit}`)?.slice(1) ?? terminal;

            for (const [key, value] of intended) {
              const resolved = actual
                .get(key)
                ?.replace(
                  PVF_PRODUCT,
                  (_match, unit: string, terminal: string, number: string) =>
                    number + seeded(unit, terminal)
                );
              const expected = value.replace(
                DIMENSION,
                (match, number: string, unit: string) =>
                  unit.toLowerCase() in map
                    ? number + lowerUntilSupported(unit.toLowerCase(), map, supported)
                    : match
              );
              expect(
                resolved,
                `${key} in a browser that ${name} (preserve: ${preserve})\ninput:\n${input}\noutput:\n${output}`
              ).toBe(expected);
            }
          }
        }
      }
    }
  });
});
