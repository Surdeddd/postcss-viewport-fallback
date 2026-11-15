import { describe, it, expect } from 'vitest';
import type { TransformStats } from '../src';
import { process, run, warningsOf } from './helpers/run';

describe('@container gets a twin rule', () => {
  it('copies the rule with the lowered prelude in front of the original', async () => {
    expect(await run(`@container card (width > 50dvw) { .a { height: 1dvh; } }`)).toBe(
      `@container card (width > 50vw) { .a { height: 1vh; height: 1dvh; } } @container card (width > 50dvw) { .a { height: 1vh; height: 1dvh; } }`
    );
  });

  it('replaces the rule with preserve: false', async () => {
    expect(
      await run(`@container card (width > 50dvw) { .a { color: red; } }`, {
        preserve: false,
      })
    ).toBe(`@container card (width > 50vw) { .a { color: red; } }`);
  });

  it('drops the original of an existing pair with preserve: false', async () => {
    expect(
      await run(
        `@container (width > 50vw) { .a { color: red; } }\n@container (width > 50dvw) { .a { color: red; } }`,
        { preserve: false }
      )
    ).toBe(`@container (width > 50vw) { .a { color: red; } }`);
  });

  it('counts an existing pair as one skip, however often its block changes', async () => {
    let stats: TransformStats | undefined;
    const out = await run(
      `@container (width > 50vw) { .a { height: 100dvh; } } @container (width > 50dvw) { .a { height: 100dvh; } }`,
      { onComplete: (s) => (stats = s) }
    );
    expect(out).toBe(
      `@container (width > 50vw) { .a { height: 100vh; height: 100dvh; } } @container (width > 50dvw) { .a { height: 100vh; height: 100dvh; } }`
    );
    expect(stats).toMatchObject({ declarations: 2, atRules: 0, skipped: 1 });
  });

  it.each([
    [`a b{color:red}`, `ab{color:red}`],
    [`a{content:"x  y"}`, `a{content:"x y"}`],
    [`a{margin:1px 2px}`, `a{margin:1px2px}`],
    [`a{*color:red}`, `a{color:red}`],
    [`a{_color:red}`, `a{color:red}`],
  ])('does not take a neighbour with %s for the twin of %s', async (neighbour, block) => {
    let stats: TransformStats | undefined;
    const input = `@container (width>1vw){${neighbour}}@container (width>1dvw){${block}}`;
    const lowered = `@container (width>1vw){${neighbour}}@container (width>1vw){${block}}`;
    expect(await run(input, { preserve: false, onComplete: (s) => (stats = s) })).toBe(
      lowered
    );
    expect(stats).toMatchObject({ atRules: 1, skipped: 0 });
    expect(await run(input)).toBe(`${lowered}@container (width>1dvw){${block}}`);
  });

  it.each([
    `@supports (height: 1dvh) { @container (width > 50dvw) { a { b: c } } }`,
    `/* postcss-viewport-fallback: off */ @container (width > 50dvw) { a { b: c } }`,
  ])('leaves %s', async (input) => {
    expect(await run(input)).toBe(input);
  });

  it('honours property filters under the name @container', async () => {
    expect(
      await run(`@container (width > 50dvw) { a { height: 1dvh } }`, {
        excludeProperties: '@container',
      })
    ).toBe(`@container (width > 50dvw) { a { height: 1vh; height: 1dvh } }`);
  });

  it('throws in strict mode and logs in verbose mode', async () => {
    await expect(
      process(`@container (width > 50dvw) { a { b: c } }`, { strict: true })
    ).rejects.toThrow('Dynamic viewport unit found: @container (width > 50dvw)');
    const logs = await warningsOf(`@container (width > 50dvw) { a { b: c } }`, {
      debug: true,
    });
    expect(logs).toContain('checking: @container (width > 50dvw)');
    expect(logs).toContain('@container: (width > 50dvw) → (width > 50vw)');
  });
});
