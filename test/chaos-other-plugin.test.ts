import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { AtRule, Plugin, Rule } from 'postcss';
import plugin from '../src';
import type { ViewportFallbackOptions } from '../src';

type Random = () => number;

function mulberry32(seed: number): Random {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROPS = ['top', 'inset', 'margin', 'margin-top', 'height', 'block-size', '--a'];
const OPTIONS: ViewportFallbackOptions[] = [
  {},
  { customUnits: { cqw: 'vw' }, includeCustomProps: true },
  { strategy: 'css-var' },
  { preserve: false },
  { customUnits: { cqw: 'svw' }, includeCustomProps: true },
];

/** A stylesheet with rules, nested rules, at-rules and keyframes, and values of every kind. */
function stylesheet(random: Random): string {
  let serial = 0;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const value = (): string => {
    const n = ++serial;
    return pick([
      `${n}dvh`,
      `${n}svw`,
      `var(--x,${n}dvh)`,
      `calc(${n}cqw - var(--y))`,
      `${n}px`,
      `${n}cqw`,
    ]);
  };
  const body = (): string =>
    Array.from(
      { length: 1 + Math.floor(random() * 4) },
      () => `${pick(PROPS)}:${value()}`
    ).join(';');
  const rule = (): string => {
    const roll = random();
    const name = `.r${++serial}`;
    if (roll < 0.2) return `${name}{${body()};&{${body()}}}`;
    if (roll < 0.3) return `${name}{&:hover{${body()}}${body()}}`;
    if (roll < 0.4) return `${name}{@media all{${body()}}}`;
    return `${name}{${body()}}`;
  };

  const parts = Array.from({ length: 1 + Math.floor(random() * 3) }, rule);
  if (random() < 0.3) parts.push(`@keyframes k{from{${body()}}to{${body()}}}`);
  if (random() < 0.3) parts.push(`@media print{${rule()}}`);
  if (random() < 0.2) parts.push(`@media screen{}`);
  return parts.join('');
}

const within = (node: Rule | AtRule, ancestor: object): boolean => {
  for (let up: typeof node.parent = node; up; up = up.parent) {
    if (up === ancestor) return true;
  }
  return false;
};

const raw = <T extends object>(node: T): T => (node as T & { proxyOf: T }).proxyOf;

/** A plugin that does a few things at random to whatever it meets: edits, removals, moves, swaps. */
function chaos(random: Random): Plugin {
  let left = 1 + Math.floor(random() * 6);
  let serial = 1000;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const act = (chance: number): boolean => left > 0 && random() < chance && left-- > 0;
  const value = (): string =>
    pick([`${++serial}dvh`, `var(--x,${++serial}dvh)`, `${++serial}px`]);

  return {
    postcssPlugin: 'chaos',
    Declaration(decl) {
      if (!act(0.12)) return;
      const actions: Array<() => void> = [
        () => void decl.remove(),
        () => void (decl.prop = pick(PROPS)),
        () => void (decl.value = value()),
        () => void (decl.important = true),
        () => void decl.after({ prop: pick(PROPS), value: value() }),
        () => void decl.before({ prop: pick(PROPS), value: value() }),
        () => void decl.replaceWith(decl.clone({ prop: pick(PROPS) })),
        () => {
          decl.before([
            decl.clone({ prop: pick(PROPS) }),
            decl.clone({ value: value() }),
          ]);
          decl.remove();
        },
        () => {
          const rules: Rule[] = [];
          decl.root().walkRules((rule) => void rules.push(rule));
          pick(rules).append(decl);
        },
      ];
      pick(actions)();
    },
    RuleExit(rule) {
      if (!act(0.08)) return;
      const actions: Array<() => void> = [
        () => void rule.remove(),
        () => void rule.root().append(rule),
        () => {
          const homes: AtRule[] = [];
          rule.root().walkAtRules('media', (media) => void homes.push(media));
          homes.find((media) => !within(media, raw(rule)))?.append(rule);
        },
      ];
      pick(actions)();
    },
    AtRuleExit(atRule) {
      if (!act(0.04)) return;
      if (random() < 0.5) atRule.remove();
      else atRule.root().append(atRule);
    },
  };
}

describe('whatever another plugin does to the stylesheet', () => {
  it.each([1, 2, 3, 4, 5, 6])(
    'the plugin settles and the result can be parsed (seed %i)',
    async (seed) => {
      for (let round = 0; round < 150; round++) {
        const random = mulberry32(seed * 104729 + round * 7919);
        const css = stylesheet(random);
        const options = OPTIONS[Math.floor(random() * OPTIONS.length)];
        const context = JSON.stringify({ seed, round, css, options });
        const run = postcss([plugin(options), chaos(random)]).process(css, {
          from: undefined,
        });
        const result = await run.then(
          (done) => done.css,
          (error: Error) => `failed: ${error.message}`
        );
        expect(result, context).not.toMatch(/^failed: /);
        expect(() => postcss.parse(result), context).not.toThrow();
      }
    }
  );
});
