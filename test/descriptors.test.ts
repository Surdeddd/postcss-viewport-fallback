import { describe, it, expect } from 'vitest';
import type { TransformStats } from '../src';
import { run } from './helpers/run';

const property = `@property --h { syntax: '<length>'; inherits: false; initial-value: 100dvh; }`;
const lowered = `@property --h { syntax: '<length>'; inherits: false; initial-value: 100vh; }`;
const registered = `${lowered}\n@supports (height: 1dvh) { ${property} }`;

describe('at-rule descriptors with the css-var strategy', () => {
  it('repeats @property under @supports with static values, because var() is invalid there', async () => {
    const out = await run(property, { strategy: 'css-var' });
    expect(out).toBe(registered);
  });

  it('keeps @property valid with preserve: false', async () => {
    const out = await run(property, { strategy: 'css-var', preserve: false });
    expect(out).toBe(
      `@property --h { syntax: '<length>'; inherits: false; initial-value: 100vh; }`
    );
  });

  it.each(['@PROPERTY --h', '@page', '@font-face', '@counter-style thing'])(
    'does not emit var() inside %s',
    async (atRule) => {
      const out = await run(`${atRule} { margin: 10dvh; }`, { strategy: 'css-var' });
      expect(out).not.toContain('var(');
      expect(out).toContain('margin: 10vh; margin: 10dvh;');
    }
  );

  it('still uses css-var for declarations nested in conditional at-rules', async () => {
    const out = await run(`.card { @media (min-width: 1px) { height: 100dvh; } }`, {
      strategy: 'css-var',
    });
    expect(out).toContain('height: calc(var(--pvf-dvh, 1vh) * 100);');
  });

  it('still uses css-var inside @keyframes', async () => {
    const out = await run(`@keyframes k { to { top: 10dvh; } }`, { strategy: 'css-var' });
    expect(out).toContain('top: calc(var(--pvf-dvh, 1vh) * 10);');
  });
});

describe('the initial value of @property', () => {
  it('is lowered, and the registration is repeated under @supports', async () => {
    let stats: TransformStats | undefined;
    const out = await run(property, { onComplete: (final) => void (stats = final) });
    expect(out).toBe(registered);
    expect(stats).toMatchObject({ declarations: 1, atRules: 0 });
    expect(await run(out)).toBe(out);
  });

  it('gets no twin: a browser drops a registration whose last initial value it cannot read', async () => {
    expect(await run(property)).not.toContain('initial-value: 100vh; initial-value');
  });

  it('is repeated once for every step of a chain of units', async () => {
    const out = await run(
      `@PROPERTY --h{syntax:"<length>";inherits:false;INITIAL-VALUE:1cqh}`,
      {
        customUnits: { cqh: 'dvh' },
      }
    );
    expect(out).toBe(
      `@PROPERTY --h{syntax:"<length>";inherits:false;INITIAL-VALUE:1vh}` +
        `@supports (height: 1dvh){@PROPERTY --h{syntax:"<length>";inherits:false;INITIAL-VALUE:1dvh}}` +
        `@supports (height: 1cqh){@PROPERTY --h{syntax:"<length>";inherits:false;INITIAL-VALUE:1cqh}}`
    );
  });

  it('is found when its name is written with an escape', async () => {
    const block = (value: string): string =>
      `@property --h{syntax:"<length>";inherits:false;initial-valu\\65:${value}}`;
    const expected = `${block('1vh')}@supports (height: 1dvh){${block('1dvh')}}`;
    expect(await run(block('1dvh'))).toBe(expected);
    expect(await run(block('1dvh'), { strategy: 'css-var' })).toBe(expected);
  });

  it('keeps the lines of a formatted rule', async () => {
    const out = await run(
      `@property --h {\n  syntax: '<length>';\n  inherits: false;\n  initial-value: 100dvh;\n}\n\na { height: var(--h); }\n`
    );
    expect(out).toBe(
      `@property --h {\n  syntax: '<length>';\n  inherits: false;\n  initial-value: 100vh;\n}\n` +
        `@supports (height: 1dvh) {\n  @property --h {\n    syntax: '<length>';\n    inherits: false;\n    initial-value: 100dvh;\n  }\n}\n\n` +
        `a { height: var(--h); }\n`
    );
  });

  it.each([
    `@supports (height: 1dvh) { ${property} }`,
    `@property --h { syntax: '<length>'; inherits: false; /* postcss-viewport-fallback: off */ initial-value: 100dvh; }`,
  ])('is left alone in %s', async (input) => {
    expect(await run(input)).toBe(input);
  });

  it('throws in strict mode and is reported once', async () => {
    await expect(run(property, { strict: true })).rejects.toThrow(
      'Dynamic viewport unit found: initial-value: 100dvh'
    );
    const seen: string[] = [];
    await run(property, {
      onTransform: ({ prop, original, fallback }) =>
        void seen.push(`${prop}: ${original} -> ${fallback}`),
    });
    expect(seen).toEqual(['initial-value: 100dvh -> 100vh']);
  });

  it.each([`a{initial-value:1dvh}`, `@font-face{initial-value:1dvh}`])(
    'is an ordinary declaration in %s',
    async (input) => {
      expect(await run(input)).toBe(
        input.replace('initial-value:1dvh', 'initial-value:1vh;initial-value:1dvh')
      );
    }
  );

  it('leaves other descriptors of the rule to the twin', async () => {
    expect(await run(`@property --h { margin: 10dvh; }`)).toBe(
      `@property --h { margin: 10vh; margin: 10dvh; }`
    );
  });
});
