import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { AtRule, Declaration, Plugin, Rule } from 'postcss';
import postcssHtml from 'postcss-html';
import plugin from '../src';
import type { TransformStats, ViewportFallbackOptions } from '../src';

async function outcome(css: string, plugins: (ours: Plugin) => Plugin[]) {
  let stats: TransformStats | undefined;
  const ours = plugin({ onComplete: (final) => void (stats = final) });
  const result = await postcss(plugins(ours)).process(css, { from: undefined });
  return { css: result.css, stats: { ...stats, timeMs: 0 } };
}

const atTop = (rule: Rule | AtRule): boolean => rule.parent?.type === 'root';

const halve = (decl: Declaration): void => {
  if (decl.value === '100dvh') decl.value = '50dvh';
};

class Prepared {
  postcssPlugin = 'prepared';

  prepare(): Partial<Plugin> {
    return { Declaration: halve };
  }
}

/** A plugin that visits nodes, and the stylesheet it leaves when it is the only one. */
const others: Array<[string, Plugin, string, string]> = [
  [
    'swaps a declaration for a clone of another name, listening to that property alone',
    {
      postcssPlugin: 'rename',
      Declaration: {
        'block-size': (decl) => void decl.replaceWith(decl.clone({ prop: 'height' })),
      },
    },
    `a{block-size:calc(100dvh - var(--h));block-size:50dvh}`,
    `a{height:calc(100dvh - var(--h));height:50dvh}`,
  ],
  [
    'splits a declaration in two',
    {
      postcssPlugin: 'split',
      Declaration(decl) {
        if (decl.prop !== 'margin-block') return;
        const [start, end] = decl.value.split(' / ');
        decl.before([
          decl.clone({ prop: 'margin-top', value: start }),
          decl.clone({ prop: 'margin-bottom', value: end }),
        ]);
        decl.remove();
      },
    },
    `a{margin-block:var(--x,1dvh) / 2dvh}`,
    `a{margin-top:var(--x,1dvh);margin-bottom:2dvh}`,
  ],
  [
    'rewrites values',
    {
      postcssPlugin: 'rem',
      Declaration(decl) {
        if (decl.value.includes('16px')) decl.value = decl.value.replace('16px', '1rem');
      },
    },
    `a{height:calc(100dvh - 16px);margin:var(--m,16px) 2dvh}`,
    `a{height:calc(100dvh - 1rem);margin:var(--m,1rem) 2dvh}`,
  ],
  [
    'writes a resolved value in front of a declaration with var()',
    {
      postcssPlugin: 'resolve',
      Declaration(decl) {
        const fallback = /^var\(--\w+,(.+)\)$/.exec(decl.value)?.[1];
        const before = decl.prev() as Declaration | undefined;
        if (fallback && before?.value !== fallback) decl.cloneBefore({ value: fallback });
      },
    },
    `a{height:var(--x,1dvh)}@keyframes k{to{top:var(--y,2dvh)}}`,
    `a{height:1dvh;height:var(--x,1dvh)}@keyframes k{to{top:2dvh;top:var(--y,2dvh)}}`,
  ],
  [
    'removes declarations',
    {
      postcssPlugin: 'remove',
      Declaration(decl) {
        if (decl.prop === 'height') decl.remove();
      },
    },
    `a{height:var(--x,1dvh);width:var(--y,2dvw)}`,
    `a{width:var(--y,2dvw)}`,
  ],
  [
    'moves the declarations of a rule into another one and removes the rule',
    {
      postcssPlugin: 'merge',
      RuleExit(rule) {
        if (rule.selector !== 'a' || !atTop(rule)) return;
        const target = rule.root().last as Rule;
        rule.each((node) => void target.append(node));
        rule.remove();
      },
    },
    `a{width:5dvw;height:var(--x,1dvh);height:3px}b{color:red}`,
    `b{color:red;width:5dvw;height:var(--x,1dvh);height:3px}`,
  ],
  [
    'takes a nested rule out of its parent',
    {
      postcssPlugin: 'unnest',
      RuleExit(rule) {
        if (rule.selector === '&:hover' && rule.parent?.type === 'rule') {
          rule.selector = 'a:hover';
          rule.parent.after(rule);
        }
      },
    },
    `a{height:var(--x,1dvh);&:hover{height:var(--y,2dvh)}}`,
    `a{height:var(--x,1dvh)}a:hover{height:var(--y,2dvh)}`,
  ],
  [
    'rewrites the prelude of an at-rule',
    {
      postcssPlugin: 'wider',
      AtRule(atRule) {
        if (atRule.name === 'media')
          atRule.params = atRule.params.replace('50dvh', '60dvh');
      },
    },
    `@media (min-height: 50dvh){a{height:1dvh}}`,
    `@media (min-height: 60dvh){a{height:1dvh}}`,
  ],
  [
    'renames keyframes',
    {
      postcssPlugin: 'scope',
      AtRule(atRule) {
        if (atRule.name === 'keyframes' && atRule.params === 'k') atRule.params = 'k-1';
      },
    },
    `@keyframes k{to{height:var(--x,1dvh)}}`,
    `@keyframes k-1{to{height:var(--x,1dvh)}}`,
  ],
  [
    'gets its visitors from a prepare() inherited from its class',
    new Prepared() as Plugin,
    `a{height:100dvh}`,
    `a{height:50dvh}`,
  ],
  [
    'inherits its visitors from another object',
    Object.assign(Object.create({ Declaration: halve }) as Plugin, {
      postcssPlugin: 'inherited',
    }),
    `a{height:100dvh}`,
    `a{height:50dvh}`,
  ],
];

describe.each(others)('next to a plugin that %s', (_, other, css, left) => {
  it.each([
    ['after', (ours: Plugin) => [other, ours]],
    ['before', (ours: Plugin) => [ours, other]],
  ])(
    'listed %s it, the plugin writes what it writes for the stylesheet that plugin leaves',
    async (__, order) => {
      expect(await outcome(css, order)).toEqual(await outcome(left, (ours) => [ours]));
    }
  );
});

describe('what the plugin writes', () => {
  const css = `a{height:100dvh;width:var(--w,1dvw)}@keyframes k{to{top:var(--y,2dvh)}}`;

  it('is not shown to the plugins that visit nodes', async () => {
    const seen: string[] = [];
    const spy: Plugin = {
      postcssPlugin: 'spy',
      Declaration(decl) {
        seen.push(decl.value);
      },
      AtRule(atRule) {
        seen.push(`@${atRule.name}`);
      },
    };
    const { css: out } = await outcome(css, (ours) => [ours, spy]);
    expect(out).toContain('height:100vh;height:100dvh');
    expect(out).toContain('@supports');
    expect(seen).toEqual(['100dvh', 'var(--w,1dvw)', '@keyframes', 'var(--y,2dvh)']);
  });

  it('is there for a plugin listed after it that works on the whole stylesheet', async () => {
    let met = '';
    const whole: Plugin = {
      postcssPlugin: 'whole',
      OnceExit(root) {
        met = root.toString();
      },
      Rule() {},
    };
    const { css: out } = await outcome(css, (ours) => [ours, whole]);
    expect(met).toBe(out);
    expect(met).toContain('height:100vh');
  });

  it('is there for a plugin that only works at the end, wherever that one is listed', async () => {
    let met = '';
    const whole: Plugin = {
      postcssPlugin: 'whole',
      OnceExit(root) {
        met = root.toString();
      },
    };
    const { css: out } = await outcome(css, (ours) => [whole, ours]);
    expect(met).toBe(out);
    expect(met).toContain('height:100vh');
  });

  it('is not there yet for such a plugin listed before it', async () => {
    let met = '';
    const whole: Plugin = {
      postcssPlugin: 'whole',
      OnceExit(root) {
        met = root.toString();
      },
      Rule() {},
    };
    await outcome(css, (ours) => [whole, ours]);
    expect(met).toBe(css);
  });
});

describe('two instances of the plugin', () => {
  const first: ViewportFallbackOptions = { customUnits: { foo: 'bar' } };
  const second: ViewportFallbackOptions = { customUnits: { bar: 'foo' } };
  const run = async (css: string, ...instances: ViewportFallbackOptions[]) =>
    (
      await postcss(instances.map((options) => plugin(options))).process(css, {
        from: undefined,
      })
    ).css;

  it('work one after the other, each on what the one before it left', async () => {
    const css = `a{height:1foo;width:var(--w,1bar)}`;
    expect(await run(css, first, second)).toBe(await run(await run(css, first), second));
  });

  it('end even when their unit mappings point at each other', async () => {
    expect(await run(`a{height:1foo}`, first, second)).toBe(`a{height:1bar;height:1foo}`);
  });
});

describe('working after the walk, next to a plugin that visits nodes', () => {
  const visitor: Plugin = { postcssPlugin: 'visitor', Rule() {} };
  const both = (options: ViewportFallbackOptions = {}) =>
    postcss([plugin(options), visitor]);
  const single = (options: ViewportFallbackOptions = {}) => postcss([plugin(options)]);

  it('reports warnings on the result of the run', async () => {
    const css = `a{&{top:1px}top:var(--x,1dvh)}`;
    const texts = async (processor: postcss.Processor) =>
      (await processor.process(css, { from: undefined }))
        .warnings()
        .map((warning) => `${warning.plugin}: ${warning.text}`);
    expect(await texts(both())).toEqual(await texts(single()));
    expect(await texts(both())).toHaveLength(1);
  });

  it('throws in strict mode with the position of the declaration', async () => {
    const failure = async (processor: postcss.Processor) =>
      processor.process(`a{\n  height:100dvh}`, { from: 'a.css' }).then(
        () => 'no error',
        (error: Error) => error.message
      );
    expect(await failure(both({ strict: true }))).toBe(
      await failure(single({ strict: true }))
    );
    expect(await failure(both({ strict: true }))).toMatch(/a\.css:2:10/);
  });

  it('calls onComplete once, with the same numbers', async () => {
    const calls: TransformStats[] = [];
    const options = { onComplete: (stats: TransformStats) => void calls.push(stats) };
    const css = `a{height:100dvh;width:var(--w,1dvw)}@media (min-height: 50dvh){b{top:0}}`;
    await both(options).process(css, { from: undefined });
    await single(options).process(css, { from: undefined });
    expect(calls).toHaveLength(2);
    expect({ ...calls[0], timeMs: 0 }).toEqual({ ...calls[1], timeMs: 0 });
    expect(calls[0]).toMatchObject({ declarations: 2, atRules: 1 });
    expect(calls[0].timeMs).toBeGreaterThanOrEqual(0);
  });

  it('gives every style block of a document its fallbacks and its seed', async () => {
    const page = `<style>.a{height:100dvh}</style><style>.b{width:var(--w,1dvw)}</style>`;
    const calls: TransformStats[] = [];
    const options: ViewportFallbackOptions = {
      strategy: 'css-var',
      onComplete: (stats) => void calls.push(stats),
    };
    const process = async (processor: postcss.Processor) =>
      (await processor.process(page, { from: 'page.html', syntax: postcssHtml() }))
        .content;
    expect(await process(both(options))).toBe(await process(single(options)));
    expect(await process(both(options))).toContain('--pvf-dvw: 1dvw');
    expect(calls).toHaveLength(3);
  });

  it('finds in every style block what an earlier plugin writes at the end, and reports it whole', async () => {
    const late: Plugin = {
      postcssPlugin: 'late',
      Rule() {},
      OnceExit(root) {
        root.walkDecls((decl) => void (decl.value = decl.value.replace('px', 'dvh')));
      },
    };
    const calls: TransformStats[] = [];
    const run = (): postcss.LazyResult =>
      postcss([
        late,
        plugin({ onComplete: (stats) => void calls.push({ ...stats }) }),
      ]).process(
        `<style>a{top:1vh;top:1dvh;height:1px}</style><style>b{height:2px}</style>`,
        { from: 'page.html', syntax: postcssHtml() }
      );
    const expected =
      `<style>a{top:1vh;top:1dvh;height:1vh;height:1dvh}</style>` +
      `<style>b{height:2vh;height:2dvh}</style>`;
    expect(run().content).toBe(expected);
    expect((await run()).content).toBe(expected);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ declarations: 2, skipped: 1 });
    expect(calls[1]).toMatchObject({ declarations: 2, skipped: 1 });
  });

  it('reports a document without a style block too', async () => {
    const calls: TransformStats[] = [];
    const onComplete = (stats: TransformStats): void => void calls.push(stats);
    const page = { from: 'page.html', syntax: postcssHtml() };
    const summary = { onComplete, debug: 'minimal' as const };
    for (const processor of [single(summary), both(summary)]) {
      const result = await processor.process(`<p>hi</p>`, page);
      expect(result.warnings()).toHaveLength(1);
      expect(processor.process(`<p>hi</p>`, page).sync().warnings()).toHaveLength(1);
    }
    await single({ onComplete, fastSkip: true }).process(`<p>hi</p>`, page);
    expect(calls).toHaveLength(5);
    expect(calls.every((stats) => stats.declarations === 0)).toBe(true);
  });

  it('reports once, and seeds, when another plugin fills an empty document', async () => {
    const fill = (): Plugin => {
      let filled = false;
      return {
        postcssPlugin: 'fill',
        DocumentExit(document) {
          if (filled) return;
          filled = true;
          document.append(postcss.parse(`a{height:var(--h,1dvh)}`));
        },
      };
    };
    const calls: TransformStats[] = [];
    const run = (): postcss.LazyResult =>
      postcss([
        plugin({
          strategy: 'css-var',
          debug: 'minimal',
          onComplete: (stats) => void calls.push(stats),
        }),
        fill(),
      ]).process(postcss.document(), { from: undefined });
    for (const result of [await run(), run().sync()]) {
      expect(result.root.toString()).toContain('--pvf-dvh: 1dvh');
      expect(result.warnings()).toHaveLength(1);
    }
    expect(calls).toHaveLength(2);
  });

  it('works through the synchronous API', () => {
    expect(both().process(`a{height:100dvh}`, { from: undefined }).css).toBe(
      `a{height:100vh;height:100dvh}`
    );
  });

  it('waits for a plugin that works asynchronously', async () => {
    const slow: Plugin = {
      postcssPlugin: 'slow',
      async Declaration(decl) {
        await Promise.resolve();
        if (decl.value === '1px') decl.value = '100dvh';
      },
    };
    const result = await postcss([plugin(), slow]).process(`a{height:1px}`, {
      from: undefined,
    });
    expect(result.css).toBe(`a{height:100vh;height:100dvh}`);
  });
});
