import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { AtRule, Declaration, Plugin } from 'postcss';
import plugin from '../src';
import type { TransformStats, ViewportFallbackOptions } from '../src';

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

const pick = <T>(random: Random, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

const UNITS = ['dvh', 'svw', 'lvh', 'cqw'] as const;
const PROPS = [
  'top',
  'inset',
  'inset-block',
  'height',
  'block-size',
  'margin',
  'margin-top',
  'margin-left',
  '--a',
  '--b',
];

interface Line {
  prop: string;
  value: string;
  important: boolean;
}

/** What the later plugin does to a declaration with a given value. */
interface Edit {
  value?: string;
  prop?: string;
  important?: boolean;
  /** Take the declaration out, unless it stands in a block this plugin wrote. */
  remove?: boolean;
}

interface Scenario {
  lines: Line[];
  nested: Line[];
  shape: (body: string, nested: string) => string;
  edits: Record<string, Edit>;
  options: ViewportFallbackOptions;
}

const SHAPES: ReadonlyArray<(body: string, nested: string) => string> = [
  (body) => `.a{${body}}`,
  (body) => `.a{@media all{${body}}}`,
  (body) => `.a{${body};&:hover{inset:0}}`,
  (body) => `.a{${body};&:hover{color:red}}`,
  (body) => `.b{top:var(--x,99dvh)}.a{${body}}`,
  (body) => `.a{color:red;${body};color:blue}`,
  (body, nested) => `.a{${body};&{${nested}}}`,
  (body, nested) => `.a{&{${nested}}${body}}`,
  (body, nested) => `.a{@media all{${body};&{${nested}}}}`,
];

/** A block of declarations and a plugin that edits some of their guarded originals in steps. */
function scenario(random: Random, touches: boolean): Scenario {
  let serial = 0;
  const late = (): string => {
    const n = ++serial;
    const unit = pick(random, UNITS);
    return random() < 0.5 ? `var(--x,${n}${unit})` : `calc(${n}${unit} - var(--y))`;
  };
  const value = (): string => {
    const roll = random();
    if (roll < 0.55) return late();
    if (roll < 0.8) return `${++serial}${pick(random, UNITS)}`;
    return `${++serial}px`;
  };

  const line = (): Line => ({
    prop: pick(random, PROPS),
    value: value(),
    important: false,
  });
  const lines = Array.from({ length: 2 + Math.floor(random() * 4) }, line);
  const nested = Array.from({ length: 1 + Math.floor(random() * 2) }, line);

  const edits: Record<string, Edit> = {};
  for (const { value: written } of [...lines, ...nested]) {
    const guarded = written.includes('var(');
    if (random() < (guarded ? 0.5 : touches ? 0.7 : 1)) continue;
    let from = written;
    for (let steps = 1 + Math.floor(random() * 3); steps > 0; steps--) {
      const edit: Edit = {};
      if (touches && from.endsWith('px') && random() < 0.3) edit.remove = true;
      if (touches && random() < 0.4) edit.prop = pick(random, PROPS);
      if (touches && random() < 0.25) edit.important = true;
      if (!touches || random() < 0.7) edit.value = value();
      edits[from] = edit;
      if (edit.remove || !edit.value) break;
      from = edit.value;
    }
  }
  if (settled(lines, edits).length === 0) {
    for (const edit of Object.values(edits)) delete edit.remove;
  }

  return {
    lines,
    nested,
    shape: pick(random, SHAPES),
    edits,
    options: {
      customUnits: random() < 0.3 ? { cqw: 'vw', vh: 'px' } : { cqw: 'vw' },
      includeCustomProps: random() < 0.6,
    },
  };
}

function apply(line: Line, edit: Edit): void {
  if (edit.prop) line.prop = edit.prop;
  if (edit.important) line.important = true;
  if (edit.value) line.value = edit.value;
}

function inOurBlock(decl: Declaration): boolean {
  let node = decl.parent;
  while (node && !(node.type === 'atrule' && (node as AtRule).name === 'supports')) {
    node = node.parent;
  }
  return node !== undefined;
}

const editor = (edits: Record<string, Edit>): Plugin => ({
  postcssPlugin: 'editor',
  Declaration(decl) {
    if (!Object.hasOwn(edits, decl.value)) return;
    const edit = edits[decl.value];
    if (!edit.remove) apply(decl, edit);
    else if (!inOurBlock(decl)) decl.remove();
  },
});

/** The block as the editing plugin leaves it when it runs alone. */
function settled(lines: readonly Line[], edits: Record<string, Edit>): Line[] {
  return lines.flatMap((line) => {
    const result = { ...line };
    for (let step = 0; step < 4 && Object.hasOwn(edits, result.value); step++) {
      const before = result.value;
      if (edits[before].remove) return [];
      apply(result, edits[before]);
      if (result.value === before) break;
    }
    return [result];
  });
}

const render = (lines: readonly Line[]): string =>
  lines
    .map(
      ({ prop, value, important }) => `${prop}:${value}${important ? ' !important' : ''}`
    )
    .join(';');

async function outcome(css: string, options: ViewportFallbackOptions, second?: Plugin) {
  let stats: TransformStats | undefined;
  const ours = plugin({ ...options, onComplete: (final) => void (stats = final) });
  const result = await postcss(second ? [ours, second] : [ours]).process(css, {
    from: undefined,
  });
  return { css: result.css, stats: { ...stats, timeMs: 0 } };
}

async function compare(seed: number, rounds: number, touches: boolean): Promise<void> {
  const random = mulberry32(seed * 7919);
  for (let round = 0; round < rounds; round++) {
    const { lines, nested, shape, edits, options } = scenario(random, touches);
    const css = shape(render(lines), render(nested));
    const context = JSON.stringify({ css, edits, options });
    const rebuilt = await outcome(css, options, editor(edits));
    const fresh = await outcome(
      shape(render(settled(lines, edits)), render(settled(nested, edits))),
      options
    );
    expect(rebuilt.css, context).toBe(fresh.css);
    expect(rebuilt.stats, context).toEqual(fresh.stats);
  }
}

describe('blocks whose values another plugin rewrites', () => {
  it.each([1, 2, 3, 4, 5, 6])(
    'end where a first run on the final values ends (seed %i)',
    (seed) => compare(seed, 250, false)
  );
});

describe('blocks whose declarations another plugin renames, stresses, removes or rewrites', () => {
  it.each([11, 12, 13, 14, 15, 16])(
    'end where a first run on the final declarations ends (seed %i)',
    (seed) => compare(seed, 250, true)
  );
});
