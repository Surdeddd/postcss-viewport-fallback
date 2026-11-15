import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { AtRule, Plugin } from 'postcss';
import plugin from '../src';
import type { TransformMeta, TransformStats } from '../src';
import { process, run } from './helpers/run';

describe('values with var() inside @keyframes', () => {
  it('lowers the value and repeats the keyframes under @supports', async () => {
    const result = await process(
      `@keyframes grow { to { height: calc(100dvh - var(--x)); } }`
    );
    expect(result.css).toBe(
      `@keyframes grow { to { height: calc(100vh - var(--x)); } }\n@supports (height: 1dvh) { @keyframes grow { to { height: calc(100dvh - var(--x)); } } }`
    );
    expect(result.warnings()).toHaveLength(0);
    expect(await run(result.css)).toBe(result.css);
  });

  it('formats a multi-line stylesheet', async () => {
    const out = await run(
      `.a {\n  color: red;\n}\n@keyframes grow {\n  to {\n    height: calc(100dvh - var(--x));\n  }\n}\n`
    );
    expect(out).toBe(`.a {
  color: red;
}
@keyframes grow {
  to {
    height: calc(100vh - var(--x));
  }
}
@supports (height: 1dvh) {
  @keyframes grow {
    to {
      height: calc(100dvh - var(--x));
    }
  }
}
`);
  });

  it('puts the copy before the rule that follows', async () => {
    expect(await run(`@keyframes k { to { top: var(--a, 1dvh); } }\n.a { color: red; }`))
      .toBe(`@keyframes k { to { top: var(--a, 1vh); } }
@supports (height: 1dvh) { @keyframes k { to { top: var(--a, 1dvh); } } }
.a { color: red; }`);
  });

  it('indents the copy of keyframes that were not indented', async () => {
    expect(await run(`@keyframes k {\nto {\ntop: var(--a, 1dvh);\n}\n}`))
      .toBe(`@keyframes k {
to {
top: var(--a, 1vh);
}
}
@supports (height: 1dvh) {
  @keyframes k {
  to {
  top: var(--a, 1dvh);
  }
  }
}`);
  });

  it('handles keyframes that another plugin created without formatting', async () => {
    const generate: Plugin = {
      postcssPlugin: 'generate',
      Once(root, { AtRule, Declaration, Rule }) {
        const keyframes = new AtRule({ name: 'keyframes', params: 'k' });
        const to = new Rule({ selector: 'to' });
        to.append(new Declaration({ prop: 'top', value: 'var(--a, 1dvh)' }));
        keyframes.append(to);
        root.append(keyframes);
      },
    };
    const result = await postcss([generate, plugin()]).process('', { from: undefined });
    const [first, second] = postcss.parse(result.css).nodes as AtRule[];
    expect(first.toString()).toContain('top: var(--a, 1vh)');
    expect(second.name).toBe('supports');
    expect(second.params).toBe('(height: 1dvh)');
    expect((second.first as AtRule).name).toBe('keyframes');
    expect(second.toString()).toContain('top: var(--a, 1dvh)');
  });

  it('covers every such declaration of the keyframes with one copy', async () => {
    let stats: TransformStats | undefined;
    const metas: TransformMeta[] = [];
    const out = await run(
      `@keyframes k { from { top: var(--a, 1dvh); left: 0; } to { top: var(--a, 2svh); width: 5dvw; } }`,
      { onComplete: (s) => (stats = s), onTransform: (meta) => metas.push(meta) }
    );
    expect(out).toBe(
      `@keyframes k { from { top: var(--a, 1vh); left: 0; } to { top: var(--a, 2vh); width: 5vw; width: 5dvw; } }\n@supports (height: 1dvh) { @keyframes k { from { top: var(--a, 1dvh); left: 0; } to { top: var(--a, 2svh); width: 5dvw; } } }`
    );
    expect(stats).toMatchObject({ declarations: 3, skipped: 0 });
    expect(
      metas.map((meta) => `${meta.prop}: ${meta.original} → ${meta.fallback}`)
    ).toEqual([
      'top: var(--a, 1dvh) → var(--a, 1vh)',
      'top: var(--a, 2svh) → var(--a, 2vh)',
      'width: 5dvw → 5vw',
    ]);
  });

  it('does the same for custom properties', async () => {
    const out = await run(`@keyframes k { from { --h: 0dvh; } to { --h: 100dvh; } }`, {
      includeCustomProps: true,
    });
    expect(out).toBe(
      `@keyframes k { from { --h: 0vh; } to { --h: 100vh; } }\n@supports (height: 1dvh) { @keyframes k { from { --h: 0dvh; } to { --h: 100dvh; } } }`
    );
  });

  it('asks for every unit the keyframes use', async () => {
    const out = await run(
      `@keyframes k { to { top: var(--a, 1cqh); left: var(--b, 2dvw); } }`,
      { customUnits: { cqh: 'vh' } }
    );
    expect(out).toBe(
      `@keyframes k { to { top: var(--a, 1vh); left: var(--b, 2vw); } }\n@supports (height: 1cqh) and (height: 1dvh) { @keyframes k { to { top: var(--a, 1cqh); left: var(--b, 2dvw); } } }`
    );
  });

  it('handles prefixed keyframes and keyframes inside another at-rule', async () => {
    const out = await run(
      `@media print { @-webkit-keyframes k { to { top: var(--a, 1dvh); } } }`
    );
    expect(out).toBe(
      `@media print { @-webkit-keyframes k { to { top: var(--a, 1vh); } } @supports (height: 1dvh) { @-webkit-keyframes k { to { top: var(--a, 1dvh); } } } }`
    );
  });

  it('leaves keyframes that already sit under a matching @supports', async () => {
    const input = `@supports (height: 1dvh) { @keyframes k { to { top: var(--a, 1dvh); } } }`;
    expect(await run(input)).toBe(input);
  });

  it('keeps a switched-off declaration as it is in both copies', async () => {
    const out = await run(
      `@keyframes k { to { /* postcss-viewport-fallback: off */ top: var(--a, 1dvh); left: var(--b, 2dvh); } }`
    );
    expect(out).toBe(
      `@keyframes k { to { /* postcss-viewport-fallback: off */ top: var(--a, 1dvh); left: var(--b, 2vh); } }\n@supports (height: 1dvh) { @keyframes k { to { /* postcss-viewport-fallback: off */ top: var(--a, 1dvh); left: var(--b, 2dvh); } } }`
    );
  });

  it('still uses a plain twin where the value has no var()', async () => {
    expect(await run(`@keyframes k { to { height: 100dvh; } }`)).toBe(
      `@keyframes k { to { height: 100vh; height: 100dvh; } }`
    );
  });

  it('rewrites in place with css-var and with preserve: false', async () => {
    expect(
      await run(`@keyframes k { to { top: var(--a, 1dvh); } }`, { preserve: false })
    ).toBe(`@keyframes k { to { top: var(--a, 1vh); } }`);
    expect(
      await run(`@keyframes k { to { top: var(--a, 1dvh); } }`, { strategy: 'css-var' })
    ).toContain(`@keyframes k { to { top: var(--a, calc(var(--pvf-dvh, 1vh) * 1)); } }`);
  });

  it('throws in strict mode', async () => {
    await expect(
      process(`@keyframes k { to { top: var(--a, 1dvh); } }`, { strict: true })
    ).rejects.toThrow('Dynamic viewport unit found: top: var(--a, 1dvh)');
  });
});
