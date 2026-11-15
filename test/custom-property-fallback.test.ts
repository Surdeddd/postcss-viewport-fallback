import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { Plugin } from 'postcss';
import plugin from '../src';
import type { TransformMeta, TransformStats } from '../src';
import { run, process, warningsOf } from './helpers/run';

const opts = { includeCustomProps: true };

describe('custom property fallbacks (duplicate strategy)', () => {
  it('keeps the fallback in place and moves the original under @supports', async () => {
    const out = await run(`:root { --h: 100dvh; }`, opts);
    expect(out).toBe(`:root { --h: 100vh; }
@supports (height: 1dvh) { :root { --h: 100dvh; } }`);
  });

  it('never leaves the modern value as a plain sibling of the fallback', async () => {
    const out = await run(`:root { --h: 100dvh; color: red; }`, opts);
    expect(out.slice(0, out.indexOf('@supports'))).not.toContain('100dvh');
  });

  it('formats a multi-line rule with matching indentation', async () => {
    const out = await run(
      `:root {
  --h: 100dvh;
  color: red;
}

.b {
  color: blue;
}
`,
      opts
    );
    expect(out).toBe(`:root {
  --h: 100vh;
  color: red;
}
@supports (height: 1dvh) {
  :root {
    --h: 100dvh;
  }
}

.b {
  color: blue;
}
`);
  });

  it('stays compact for minified input', async () => {
    const out = await run(`.a{--h:100dvh}.b{color:blue}`, opts);
    expect(out).toBe(
      `.a{--h:100vh}@supports (height: 1dvh){.a{--h:100dvh}}.b{color:blue}`
    );
  });

  it('stays compact for a lone minified rule', async () => {
    const out = await run(`.a{--h:100dvh}`, opts);
    expect(out).toBe(`.a{--h:100vh}@supports (height: 1dvh){.a{--h:100dvh}}`);
  });

  it('nests the guard next to a rule inside an at-rule', async () => {
    const out = await run(
      `@media (min-width: 1px) {
  .a {
    --h: 100dvh !important;
  }
}
`,
      opts
    );
    expect(out).toBe(`@media (min-width: 1px) {
  .a {
    --h: 100vh !important;
  }
  @supports (height: 1dvh) {
    .a {
      --h: 100dvh !important;
    }
  }
}
`);
  });

  it('works for un-flattened nested rules', async () => {
    const out = await run(`.card { & .inner { --h: 100dvh; } }`, opts);
    expect(out).toBe(
      `.card { & .inner { --h: 100vh; } @supports (height: 1dvh) { & .inner { --h: 100dvh; } } }`
    );
  });

  it('merges several custom properties of one rule into one guard', async () => {
    const out = await run(
      `:root { --a: 100dvh; --b: calc(50dvh - 1px); color: red; }`,
      opts
    );
    expect(out).toBe(`:root { --a: 100vh; --b: calc(50vh - 1px); color: red; }
@supports (height: 1dvh) { :root { --a: 100dvh; --b: calc(50dvh - 1px); } }`);
  });

  it('shares one guard between all built-in units', async () => {
    const out = await run(`:root { --a: 100dvh; --b: 50svw; }`, opts);
    expect(out).toBe(`:root { --a: 100vh; --b: 50vw; }
@supports (height: 1dvh) { :root { --a: 100dvh; --b: 50svw; } }`);
  });

  it('creates one guard per distinct unit requirement, in source order', async () => {
    const out = await run(`:root { --a: 100dvh; --b: 50cqw; }`, {
      ...opts,
      customUnits: { cqw: 'vw' },
    });
    expect(out).toBe(`:root { --a: 100vh; --b: 50vw; }
@supports (height: 1dvh) { :root { --a: 100dvh; } }
@supports (height: 1cqw) { :root { --b: 50cqw; } }`);
  });

  it('requires every unit of a mixed value', async () => {
    const out = await run(`:root { --x: calc(100dvh - 10cqw - 1svh); }`, {
      ...opts,
      customUnits: { cqw: 'vw' },
    });
    expect(out).toBe(`:root { --x: calc(100vh - 10vw - 1vh); }
@supports (height: 1cqw) and (height: 1dvh) { :root { --x: calc(100dvh - 10cqw - 1svh); } }`);
  });

  it('keeps the selector list and separate rules independent', async () => {
    const out = await run(`:root, :host { --h: 100dvh; }\n.dark { --h: 90dvh; }`, opts);
    expect(out).toBe(`:root, :host { --h: 100vh; }
@supports (height: 1dvh) { :root, :host { --h: 100dvh; } }
.dark { --h: 90vh; }
@supports (height: 1dvh) { .dark { --h: 90dvh; } }`);
  });

  it('emits a progressive ladder for customUnits chains', async () => {
    const out = await run(`:root { --h: 100cqh; }`, {
      ...opts,
      customUnits: { cqh: 'svh' },
    });
    expect(out).toBe(`:root { --h: 100vh; }
@supports (height: 1dvh) { :root { --h: 100svh; } }
@supports (height: 1cqh) { :root { --h: 100cqh; } }`);
  });

  it('leaves a declaration that a later sibling overrides', async () => {
    const input = `.a { --h: 100dvh; --h: 5px; }`;
    expect(await run(input, opts)).toBe(input);
  });

  it('guards an !important declaration that wins over a later sibling', async () => {
    const out = await run(`.a { --h: 100dvh !important; --h: 5px; }`, opts);
    expect(out).toBe(`.a { --h: 100vh !important; --h: 5px; }
@supports (height: 1dvh) { .a { --h: 100dvh !important; } }`);
  });

  it('upgrades a twin left by 1.x into a working ladder', async () => {
    const out = await run(`.a { --h: 100vh; --h: 100dvh; }`, opts);
    expect(out).toBe(`.a { --h: 100vh; --h: 100vh; }
@supports (height: 1dvh) { .a { --h: 100dvh; } }`);
  });

  it('does not reuse a fallback that another declaration of the property overrides', async () => {
    const out = await run(`.a { --h: 100vh; --h: 5px; --h: 100dvh; }`, opts);
    expect(out).toBe(`.a { --h: 100vh; --h: 5px; --h: 100vh; }
@supports (height: 1dvh) { .a { --h: 100dvh; } }`);
  });

  it('keeps legacy browsers on the fallback when an earlier duplicate is left untouched', async () => {
    const out = await run(`.a { --h: 100vh; --h: 100dvh; --h: 100dvh; }`, opts);
    expect(out).toBe(`.a { --h: 100vh; --h: 100dvh; --h: 100vh; }
@supports (height: 1dvh) { .a { --h: 100dvh; } }`);
  });

  it('is idempotent across runs', async () => {
    const first = await run(
      `:root { --a: 100dvh; --b: 50svw; }\n.x { height: 100dvh; }`,
      opts
    );
    expect(await run(first, opts)).toBe(first);
  });

  it('is idempotent for chains', async () => {
    const chain = { ...opts, customUnits: { cqh: 'svh' } };
    const first = await run(`:root { --h: 100cqh; }`, chain);
    expect(await run(first, chain)).toBe(first);
  });

  it('counts one transform and reports it through onTransform', async () => {
    const metas: TransformMeta[] = [];
    let stats: TransformStats | undefined;
    await run(`:root { --h: 100dvh; }`, {
      ...opts,
      onTransform: (meta) => metas.push(meta),
      onComplete: (s) => (stats = s),
    });
    expect(metas).toHaveLength(1);
    expect(metas[0]).toMatchObject({
      prop: '--h',
      original: '100dvh',
      fallback: '100vh',
      selector: ':root',
    });
    expect(stats).toMatchObject({ declarations: 1, atRules: 0, skipped: 0 });
  });

  it('respects property filters', async () => {
    const input = `:root { --keep: 100dvh; }`;
    expect(await run(input, { ...opts, excludeProperties: '--keep' })).toBe(input);
  });

  it('throws in strict mode', async () => {
    await expect(
      process(`:root { --h: 100dvh; }`, { ...opts, strict: true })
    ).rejects.toThrow('Dynamic viewport unit found');
  });

  it('handles custom properties inside an at-rule that gets a fallback itself', async () => {
    const out = await run(`@media (min-height: 50dvh) { :root { --h: 100dvh; } }`, opts);
    expect(out).toBe(
      `@media (min-height: 50vh), (min-height: 50dvh) { :root { --h: 100vh; } @supports (height: 1dvh) { :root { --h: 100dvh; } } }`
    );
  });

  it('handles custom properties inside both copies of an at-rule twin', async () => {
    const out = await run(
      `@container (min-height: 50dvh) { :root { --h: 100dvh; } }`,
      opts
    );
    expect(out).toBe(
      `@container (min-height: 50vh) { :root { --h: 100vh; } @supports (height: 1dvh) { :root { --h: 100dvh; } } } @container (min-height: 50dvh) { :root { --h: 100vh; } @supports (height: 1dvh) { :root { --h: 100dvh; } } }`
    );
  });
});

describe('custom property fallbacks: contexts without a valid guard', () => {
  it('guards keyframe custom properties by repeating the keyframes', async () => {
    const result = await process(
      `@keyframes grow { from { --h: 0dvh; } to { --h: 100dvh; } }`,
      opts
    );
    expect(result.css).toBe(`@keyframes grow { from { --h: 0vh; } to { --h: 100vh; } }
@supports (height: 1dvh) { @keyframes grow { from { --h: 0dvh; } to { --h: 100dvh; } } }`);
    expect(result.warnings()).toHaveLength(0);
  });

  it('leaves a top-level declaration (inline style / CSS-in-JS fragment) untouched and warns', async () => {
    const input = `--h: 100dvh; color: red;`;
    const result = await process(input, opts);
    expect(result.css).toBe(input);
    expect(result.warnings()).toHaveLength(1);
  });

  it('leaves a top-level at-rule with bare custom properties untouched and warns', async () => {
    const input = `@page { --h: 100dvh; }`;
    const result = await process(input, opts);
    expect(result.css).toBe(input);
    expect(result.warnings()).toHaveLength(1);
  });

  it('leaves a declaration that follows a nested block setting the same property and warns', async () => {
    const input = `.a { @media (min-width: 1px) { --h: 50px; } --h: 100dvh; }`;
    const result = await process(input, opts);
    expect(result.css).toBe(input);
    expect(result.warnings()).toHaveLength(1);
  });

  it('does not warn without includeCustomProps', async () => {
    expect(await warningsOf(`@keyframes grow { to { --h: 100dvh; } }`)).toEqual([]);
  });

  it('replaces in place everywhere when preserve is false', async () => {
    const out = await run(`@keyframes grow { to { --h: 100dvh; } }\n--top: 10dvh;`, {
      ...opts,
      preserve: false,
    });
    expect(out).toBe(`@keyframes grow { to { --h: 100vh; } }\n--top: 10vh;`);
  });
});

describe('custom property fallbacks (css-var strategy)', () => {
  const cssVar = { ...opts, strategy: 'css-var' as const };

  it('rewrites in place without keeping the modern twin', async () => {
    const out = await run(`:root { --h: 100dvh; }`, cssVar);
    expect(out).toContain(':root { --h: calc(var(--pvf-dvh, 1vh) * 100); }');
    expect(out).not.toContain('--h: 100dvh');
    expect(out).not.toContain('@supports (height: 1dvh) { :root { --h');
  });

  it('still preserves regular declarations next to it', async () => {
    const out = await run(`.a { --h: 100dvh; height: 100dvh; }`, cssVar);
    expect(out).toContain(
      '.a { --h: calc(var(--pvf-dvh, 1vh) * 100); height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }'
    );
  });

  it('works in contexts where a guard would be impossible', async () => {
    const result = await process(`@keyframes grow { to { --h: 100dvh; } }`, cssVar);
    expect(result.css).toContain('to { --h: calc(var(--pvf-dvh, 1vh) * 100); }');
    expect(result.warnings()).toHaveLength(0);
  });

  it('is idempotent across runs', async () => {
    const first = await run(`:root { --h: 100dvh; }\n.a { height: 50svh; }`, cssVar);
    expect(await run(first, cssVar)).toBe(first);
  });
});

describe('custom property fallbacks: nodes without source formatting', () => {
  it('guards custom properties of rules generated by another plugin', async () => {
    const generator: Plugin = {
      postcssPlugin: 'generator',
      Once(root, { Rule, Declaration }) {
        const rule = new Rule({ selector: '.gen' });
        rule.append(new Declaration({ prop: '--h', value: '100dvh' }));
        root.append(rule);
      },
    };
    const result = await postcss([generator, plugin(opts)]).process(
      `.a { color: red; }`,
      {
        from: undefined,
      }
    );
    const reparsed = postcss.parse(result.css);
    const [first, gen, guard] = reparsed.nodes;
    expect(first.toString()).toBe('.a { color: red; }');
    expect(gen.type === 'rule' && gen.selector).toBe('.gen');
    expect(gen.toString()).toContain('--h: 100vh');
    expect(guard.type === 'atrule' && guard.params).toBe('(height: 1dvh)');
    expect(guard.toString()).toContain('--h: 100dvh');
    expect(reparsed.nodes).toHaveLength(3);
  });

  it('uses a two-space step when the declaration is not indented deeper than its rule', async () => {
    const out = await run(`.a {\n--h: 100dvh;\n}\n`, opts);
    expect(out).toBe(`.a {
--h: 100vh;
}
@supports (height: 1dvh) {
  .a {
    --h: 100dvh;
  }
}
`);
  });

  it('places the guard on the same line as rules that share a line', async () => {
    const out = await run(`.a { --h: 100dvh; } .b { color: red; }`, opts);
    expect(out).toBe(
      `.a { --h: 100vh; } @supports (height: 1dvh) { .a { --h: 100dvh; } } .b { color: red; }`
    );
  });
});

describe('custom property fallbacks in nested CSS', () => {
  it('nests the guard when a later nested block sets the same property', async () => {
    const out = await run(
      `:root { --h: 100dvh; @media (orientation: landscape) { --h: 60dvh; } }`,
      opts
    );
    expect(out).toBe(
      `:root { --h: 100vh; @supports (height: 1dvh) { --h: 100dvh; } @media (orientation: landscape) { --h: 60vh; @supports (height: 1dvh) { --h: 60dvh; } } }`
    );
  });

  it('keeps the cascade order of the source: no guard is hoisted past the nested override', async () => {
    const out = await run(`.a { --h: 100dvh; & .b { --h: 5px; } }`, opts);
    expect(out).toBe(
      `.a { --h: 100vh; @supports (height: 1dvh) { --h: 100dvh; } & .b { --h: 5px; } }`
    );
  });

  it('still hoists a flat guard when nested blocks do not touch the property', async () => {
    const out = await run(`.a { --h: 100dvh; & .b { color: red; } }`, opts);
    expect(out).toBe(`.a { --h: 100vh; & .b { color: red; } }
@supports (height: 1dvh) { .a { --h: 100dvh; } }`);
  });

  it('guards a declaration that sits directly in a nested at-rule', async () => {
    const out = await run(
      `.card { @media (min-width: 1px) { --h: 100dvh; color: red; } }`,
      opts
    );
    expect(out).toBe(
      `.card { @media (min-width: 1px) { --h: 100vh; @supports (height: 1dvh) { --h: 100dvh; } color: red; } }`
    );
  });

  it('formats a nested guard like its surroundings', async () => {
    const out = await run(
      `:root {
  --h: 100dvh;
  @media (orientation: landscape) {
    --h: 60dvh;
  }
}
`,
      opts
    );
    expect(out).toBe(`:root {
  --h: 100vh;
  @supports (height: 1dvh) {
    --h: 100dvh;
  }
  @media (orientation: landscape) {
    --h: 60vh;
    @supports (height: 1dvh) {
      --h: 60dvh;
    }
  }
}
`);
  });

  it('emits the chain ladder in nested form too', async () => {
    const out = await run(`.a { --h: 100cqh; & { --h: 1px; } }`, {
      ...opts,
      customUnits: { cqh: 'svh' },
    });
    expect(out).toBe(
      `.a { --h: 100vh; @supports (height: 1dvh) { --h: 100svh; } @supports (height: 1cqh) { --h: 100cqh; } & { --h: 1px; } }`
    );
  });

  it('is idempotent for nested guards', async () => {
    const first = await run(
      `:root { --h: 100dvh; @media (orientation: landscape) { --h: 60dvh; } }`,
      opts
    );
    expect(await run(first, opts)).toBe(first);
  });

  it('skips a nested declaration that a later sibling overrides', async () => {
    const input = `.a { @media (min-width: 1px) { --h: 100dvh; --h: 5px; } }`;
    const result = await process(input, opts);
    expect(result.css).toBe(input);
    expect(result.warnings()).toHaveLength(0);
  });
});

describe('custom property fallbacks: nested guards without source formatting', () => {
  it('nests guards inside rules and at-rules generated by another plugin', async () => {
    const generator: Plugin = {
      postcssPlugin: 'generator',
      Once(root, { AtRule, Rule, Declaration }) {
        const override = new Rule({ selector: '&' });
        override.append(new Declaration({ prop: '--h', value: '1px' }));
        const withOverride = new Rule({ selector: '.gen' });
        withOverride.append(new Declaration({ prop: '--h', value: '100dvh' }), override);

        const multiline = new Declaration({ prop: '--w', value: '100dvw' });
        multiline.raws.before = '\n  ';
        const lateOverride = new Rule({ selector: '&' });
        lateOverride.append(new Declaration({ prop: '--w', value: '1px' }));
        const withNewline = new Rule({ selector: '.gen-lines' });
        withNewline.append(multiline, lateOverride);

        const media = new AtRule({ name: 'media', params: '(min-width: 1px)' });
        media.append(new Declaration({ prop: '--m', value: '100dvh' }));
        const withMedia = new Rule({ selector: '.gen-media' });
        withMedia.append(media);

        root.append(withOverride, withNewline, withMedia);
      },
    };
    const result = await postcss([generator, plugin(opts)]).process(
      `.a { color: red; }`,
      {
        from: undefined,
      }
    );

    const reparsed = postcss.parse(result.css);
    const shape = (node: postcss.ChildNode): unknown =>
      node.type === 'decl'
        ? `${node.prop}: ${node.value}`
        : node.type === 'rule'
          ? { [node.selector]: node.nodes.map(shape) }
          : node.type === 'atrule'
            ? { [`@${node.name} ${node.params}`]: (node.nodes ?? []).map(shape) }
            : node.type;

    expect(reparsed.nodes.slice(1).map(shape)).toEqual([
      {
        '.gen': [
          '--h: 100vh',
          { '@supports (height: 1dvh)': ['--h: 100dvh'] },
          { '&': ['--h: 1px'] },
        ],
      },
      {
        '.gen-lines': [
          '--w: 100vw',
          { '@supports (height: 1dvh)': ['--w: 100dvw'] },
          { '&': ['--w: 1px'] },
        ],
      },
      {
        '.gen-media': [
          {
            '@media (min-width: 1px)': [
              '--m: 100vh',
              { '@supports (height: 1dvh)': ['--m: 100dvh'] },
            ],
          },
        ],
      },
    ]);
  });

  it('uses a two-space step when a nested declaration is not indented deeper than its host', async () => {
    const out = await run(`.a {\n--h: 100dvh;\n& .b { --h: 1px; }\n}\n`, opts);
    expect(out).toBe(`.a {
--h: 100vh;
@supports (height: 1dvh) {
  --h: 100dvh;
}
& .b { --h: 1px; }
}
`);
  });

  it('keeps a missing trailing semicolon missing inside the nested guard', async () => {
    const out = await run(`.card { @media (min-width: 1px) { --h: 100dvh } }`, opts);
    expect(out).toBe(
      `.card { @media (min-width: 1px) { --h: 100vh; @supports (height: 1dvh) { --h: 100dvh } } }`
    );
  });
});

describe('custom property fallbacks: last declaration without a semicolon', () => {
  it('keeps single-line spacing intact', async () => {
    const out = await run(`:root { --h: 100dvh }`, opts);
    expect(out).toBe(`:root { --h: 100vh }
@supports (height: 1dvh) { :root { --h: 100dvh } }`);
  });

  it('keeps multi-line layout intact', async () => {
    const out = await run(`:root {\n  --h: 100dvh\n}\n`, opts);
    expect(out).toBe(`:root {
  --h: 100vh
}
@supports (height: 1dvh) {
  :root {
    --h: 100dvh;
  }
}
`);
  });

  it('keeps the spacing when an earlier declaration of the property exists', async () => {
    const out = await run(`.a { --h: 100vh; --h: 100dvh }`, opts);
    expect(out).toBe(`.a { --h: 100vh; --h: 100vh }
@supports (height: 1dvh) { .a { --h: 100dvh } }`);
  });

  it('rewrites in place without touching the spacing for css-var and preserve: false', async () => {
    expect(await run(`:root { --h: 100dvh }`, { ...opts, preserve: false })).toBe(
      `:root { --h: 100vh }`
    );
    expect(
      await run(`:root { --h: 100dvh }`, { ...opts, strategy: 'css-var' })
    ).toContain(`:root { --h: calc(var(--pvf-dvh, 1vh) * 100) }`);
  });
});
