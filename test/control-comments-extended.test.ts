import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { ChildNode, Plugin } from 'postcss';
import plugin from '../src';
import type { TransformStats } from '../src';
import { run } from './helpers/run';

describe('control comment syntax', () => {
  it.each([
    '/*postcss-viewport-fallback:off*/',
    '/* postcss-viewport-fallback:off */',
    '/* POSTCSS-VIEWPORT-FALLBACK: OFF */',
    '/*  postcss-viewport-fallback :   off  */',
  ])('accepts %s', async (comment) => {
    const out = await run(`.a { ${comment} height: 100dvh; width: 1dvw; }`);
    expect(out).not.toContain('height: 100vh');
    expect(out).toContain('width: 1vw');
  });

  it('accepts relaxed spelling for ranges', async () => {
    const out = await run(`/*postcss-viewport-fallback:disable*/
.a { height: 100dvh; }
/* Postcss-Viewport-Fallback: ENABLE */
.b { height: 100dvh; }`);
    expect(out).toContain('.a { height: 100dvh; }');
    expect(out).toContain('.b { height: 100vh; height: 100dvh; }');
  });

  it.each([
    '/* postcss-viewport-fallback: offline */',
    '/* postcss-viewport-fallback */',
    '/* my postcss-viewport-fallback: off */',
    '/* postcss-viewport-fallback: off please */',
  ])('ignores %s', async (comment) => {
    const out = await run(`.a { ${comment} height: 100dvh; }`);
    expect(out).toContain('height: 100vh');
  });
});

describe('control comment ranges: scoping', () => {
  it('lets an inner enable override an outer disable', async () => {
    const out = await run(`/* postcss-viewport-fallback: disable */
.a { /* postcss-viewport-fallback: enable */ height: 100dvh; }
.b { height: 100dvh; }`);
    expect(out).toContain('height: 100vh; height: 100dvh; }\n.b');
    expect(out).toContain('.b { height: 100dvh; }');
  });

  it('does not leak a range out of the block it was opened in', async () => {
    const out = await run(`.a { /* postcss-viewport-fallback: disable */ height: 100dvh; }
.b { height: 100dvh; }`);
    expect(out).toContain(
      '.a { /* postcss-viewport-fallback: disable */ height: 100dvh; }'
    );
    expect(out).toContain('.b { height: 100vh; height: 100dvh; }');
  });

  it('applies the nearest marker when several precede a node', async () => {
    const out = await run(`/* postcss-viewport-fallback: disable */
/* postcss-viewport-fallback: enable */
/* postcss-viewport-fallback: disable */
.a { height: 100dvh; }
/* postcss-viewport-fallback: enable */
.b { height: 100dvh; }`);
    expect(out).toContain('.a { height: 100dvh; }');
    expect(out).toContain('.b { height: 100vh; height: 100dvh; }');
  });

  it('keeps an enabled at-rule enabled inside an outer disabled range', async () => {
    const out = await run(`/* postcss-viewport-fallback: disable */
.card {
  /* postcss-viewport-fallback: enable */
  @media (min-height: 50dvh) { width: 10dvw; }
}`);
    expect(out).toContain(
      '@media (min-height: 50vh), (min-height: 50dvh) { width: 10vw; width: 10dvw; }'
    );
  });

  it('keeps both copies of an enabled @container enabled inside an outer disabled range', async () => {
    const out = await run(`/* postcss-viewport-fallback: disable */
.card {
  /* postcss-viewport-fallback: enable */
  @container (min-height: 50dvh) { width: 10dvw; }
}`);
    expect(out).toContain('@container (min-height: 50vh) { width: 10vw; width: 10dvw; }');
    expect(out).toContain(
      '@container (min-height: 50dvh) { width: 10vw; width: 10dvw; }'
    );
  });

  it('applies range comments inside a twinned at-rule to both copies', async () => {
    const out = await run(`@container (min-height: 50dvh) {
  /* postcss-viewport-fallback: disable */
  .a { width: 10dvw; }
  /* postcss-viewport-fallback: enable */
  .b { width: 10dvw; }
}
/* postcss-viewport-fallback: disable */
.c { width: 10dvw; }`);
    expect((out.match(/\.a \{ width: 10dvw; \}/g) ?? []).length).toBe(2);
    expect((out.match(/\.b \{ width: 10vw; width: 10dvw; \}/g) ?? []).length).toBe(2);
    expect(out).toContain('.c { width: 10dvw; }');
  });

  it('point-form off does not cascade into the block of the next at-rule', async () => {
    const out = await run(`/* postcss-viewport-fallback: off */
@media (min-height: 50dvh) { .a { width: 10dvw; } }`);
    expect(out).not.toContain('min-height: 50vh');
    expect(out).toContain('width: 10vw; width: 10dvw;');
  });
});

describe('control comment ranges: live tree', () => {
  const insertAfterSrc: Plugin = {
    postcssPlugin: 'insert-after-src',
    Rule(rule, { Rule, Declaration }) {
      if (rule.selector !== '.src') return;
      rule.selector = '.src-done';
      const generated = new Rule({ selector: '.gen' });
      generated.append(new Declaration({ prop: 'height', value: '100dvh' }));
      rule.after(generated);
      rule.after(new Rule({ selector: '.spacer' }));
    },
  };

  it('leaves nodes that another plugin inserts into a disabled range', async () => {
    const result = await postcss([insertAfterSrc, plugin()]).process(
      `/* postcss-viewport-fallback: disable */
.src { color: red; }
/* postcss-viewport-fallback: enable */
.tail { height: 100dvh; }`,
      { from: undefined }
    );
    expect(result.css).toContain('.gen { height: 100dvh; }');
    expect(result.css).toContain('.tail { height: 100vh; height: 100dvh; }');
  });

  it('transforms nodes that another plugin inserts into an enabled range', async () => {
    const result = await postcss([insertAfterSrc, plugin()]).process(
      `/* postcss-viewport-fallback: disable */
.head { height: 100dvh; }
/* postcss-viewport-fallback: enable */
.src { color: red; }`,
      { from: undefined }
    );
    expect(result.css).toContain('.head { height: 100dvh; }');
    expect(result.css).toContain('.gen { height: 100vh; height: 100dvh; }');
  });

  const unwrap: Plugin = {
    postcssPlugin: 'unwrap',
    Rule(rule) {
      let last: ChildNode = rule;
      rule.each((child) => {
        if (child.type !== 'rule') return;
        const comment = child.prev();
        child.selector = child.selector.replace('&', rule.selector);
        if (comment?.type === 'comment') {
          last.after(comment);
          last = comment;
        }
        last.after(child);
        last = child;
      });
    },
  };

  describe.each([
    ['before', [unwrap, plugin()]],
    ['after', [plugin(), unwrap]],
  ])(
    'with a plugin that moves nested rules out, listed %s this one',
    (_where, plugins) => {
      it('keeps a range with the declarations it was written around', async () => {
        const result = await postcss(plugins).process(
          `.a { /* postcss-viewport-fallback: disable */ height: 100dvh; /* postcss-viewport-fallback: enable */ & .b { width: 100dvw; } }`,
          { from: undefined }
        );
        expect(result.css).toContain(
          '.a { /* postcss-viewport-fallback: disable */ height: 100dvh }'
        );
        expect(result.css).toContain('.a .b { width: 100vw; width: 100dvw; }');
      });

      it('follows range comments that travel with the moved rules', async () => {
        const result = await postcss(plugins).process(
          `.a { /* postcss-viewport-fallback: disable */ & .b { height: 100dvh; } /* postcss-viewport-fallback: enable */ & .c { height: 100dvh; } }`,
          { from: undefined }
        );
        expect(result.css).toContain('.a .b { height: 100dvh; }');
        expect(result.css).toContain('.a .c { height: 100vh; height: 100dvh; }');
      });
    }
  );

  it('re-reads comments when the same Root object is processed again', async () => {
    const root = postcss.parse(`.a { height: 100dvh; }`);
    const shared = plugin();
    await postcss([shared]).process(root, { from: undefined });
    root.prepend(postcss.comment({ text: 'postcss-viewport-fallback: disable' }));
    root.append(postcss.parse(`\n.b { width: 10dvw; }`).first!);
    const again = await postcss([shared]).process(root, { from: undefined });
    expect(again.css).toContain('.b { width: 10dvw; }');
    expect(again.css).not.toContain('width: 10vw');
  });

  it('reads the state of a block it wrote itself from the rule in front of it', async () => {
    const off = `/* postcss-viewport-fallback: disable */.x{height:1dvh}`;
    const on = `/* postcss-viewport-fallback: enable */`;
    const result = await postcss([plugin()]).process(
      `${off}${on}.a{height:var(--x,1dvh)}`,
      { from: undefined }
    );
    expect(result.css).toBe(
      `${off}${on}.a{height:var(--x,1vh)}@supports (height: 1dvh){.a{height:var(--x,1dvh)}}`
    );
  });

  it('takes a twin written in front of everything else in the block for enabled', async () => {
    const chain = { customUnits: { cqh: 'cqb', cqb: 'svh' } };
    const result = await postcss([plugin(chain)]).process(
      `.a{height:1cqh;/* postcss-viewport-fallback: disable */width:1cqh}`,
      { from: undefined }
    );
    expect(result.css).toBe(
      `.a{height:1vh;height:1svh;height:1cqb;height:1cqh;` +
        `/* postcss-viewport-fallback: disable */width:1cqh}`
    );
  });
});

describe('a declaration switched off after a value that moves into @supports', () => {
  const options = { customUnits: { cqh: 'vh' } };
  const off = `/* postcss-viewport-fallback: off */`;

  it.each([
    ['a range', `/* postcss-viewport-fallback: disable */`],
    ['a point comment', off],
  ])('stays switched off in its copy, under %s', async (_, comment) => {
    let stats: TransformStats | undefined;
    const out = await run(`a{height:var(--x,1dvh);${comment}height:2cqh}`, {
      ...options,
      onComplete: (final) => void (stats = final),
    });
    expect(out).toBe(
      `a{height:var(--x,1vh);${comment}height:2cqh}` +
        `@supports (height: 1dvh){a{height:var(--x,1dvh);${off}height:2cqh}}`
    );
    expect(stats).toMatchObject({ declarations: 1 });
    expect(await run(out, options)).toBe(out);
  });

  it('keeps the comment with its copy when an earlier copy is written in front of it', async () => {
    const disable = `/* postcss-viewport-fallback: disable */`;
    const enable = `/* postcss-viewport-fallback: enable */`;
    const out = await run(
      `a{height:var(--x,1dvh);${disable}height:2cqh;${enable}height:var(--y,3dvh)}`,
      options
    );
    expect(out).toBe(
      `a{height:var(--x,1vh);${disable}height:2cqh;${enable}height:var(--y,3vh)}` +
        `@supports (height: 1dvh){a{height:var(--x,1dvh);${off}height:2cqh;height:var(--y,3dvh)}}`
    );
    expect(await run(out, options)).toBe(out);
  });

  it('writes no comment for a copy that has nothing to lower', async () => {
    expect(
      await run(
        `a{height:var(--x,1dvh);/* postcss-viewport-fallback: disable */height:5px}`
      )
    ).toBe(
      `a{height:var(--x,1vh);/* postcss-viewport-fallback: disable */height:5px}` +
        `@supports (height: 1dvh){a{height:var(--x,1dvh);height:5px}}`
    );
  });

  it('gives the comment the line of its copy, whatever the first comment of the file looks like', async () => {
    const out = await run(
      `/*! licence */ a {\n  height: var(--x, 1dvh);\n  /* postcss-viewport-fallback: off */\n  height: 2cqh;\n}\n`,
      options
    );
    expect(out).toBe(
      `/*! licence */ a {\n  height: var(--x, 1vh);\n  /* postcss-viewport-fallback: off */\n  height: 2cqh;\n}\n` +
        `@supports (height: 1dvh) {\n  a {\n    height: var(--x, 1dvh);\n    /* postcss-viewport-fallback: off */\n    height: 2cqh;\n  }\n}\n`
    );
  });
});
