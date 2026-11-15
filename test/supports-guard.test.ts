import { describe, it, expect } from 'vitest';
import type { TransformStats } from '../src';
import { run, process } from './helpers/run';

describe('@supports feature queries are never rewritten', () => {
  it('leaves a block that requires the unit untouched', async () => {
    const input = `@supports (height: 100dvh) { .a { height: 100dvh; } }`;
    expect(await run(input)).toBe(input);
  });

  it('keeps a hand-written custom-property ladder intact', async () => {
    const input = `:root { --h: 100vh; }
@supports (height: 100dvh) { :root { --h: 100dvh; } }`;
    expect(await run(input)).toBe(input);
  });

  it('keeps the ladder intact with includeCustomProps too', async () => {
    const input = `:root { --h: 100vh; }
@supports (height: 100dvh) { :root { --h: 100dvh; } }`;
    expect(await run(input, { includeCustomProps: true })).toBe(input);
  });

  it('keeps a regular-property ladder intact', async () => {
    const input = `.player { height: 100vh; }
@supports (height: 100dvh) { .player { height: 100dvh; } }`;
    expect(await run(input)).toBe(input);
  });

  it('does not create a vh twin of a negated query', async () => {
    const out = await run(
      `@supports not (height: 100dvh) { .legacy { display: block; } }`
    );
    expect(out).toBe(`@supports not (height: 100dvh) { .legacy { display: block; } }`);
  });

  it('ignores @supports in property filters without failing', async () => {
    const input = `@supports (height: 100dvh) { .a { color: red; } }`;
    expect(await run(input, { excludeProperties: ['@supports'] })).toBe(input);
    expect(await run(input, { onlyProperties: ['@supports'] })).toBe(input);
  });

  it('does not throw in strict mode for a guarded block', async () => {
    const input = `@supports (height: 100dvh) { .a { height: 100dvh; } }`;
    expect(await run(input, { strict: true })).toBe(input);
  });

  it('reports no transforms for a guarded block', async () => {
    let stats: TransformStats | undefined;
    await run(`@supports (height: 100dvh) { .a { height: 100dvh; } }`, {
      onComplete: (s) => (stats = s),
    });
    expect(stats).toMatchObject({ declarations: 0, atRules: 0, skipped: 0 });
  });
});

describe('declarations guarded by an enclosing @supports', () => {
  it('skips when every unit is required by a conjunction', async () => {
    const input = `@supports (height: 100dvh) and (width: 1svw) { .a { height: calc(100dvh - 1svw); } }`;
    expect(await run(input)).toBe(input);
  });

  it('skips through intermediate at-rules and nested rules', async () => {
    const input = `@supports (height: 1dvh) { @media screen { .a { & .b { height: 100dvh; } } } }`;
    expect(await run(input)).toBe(input);
  });

  it('combines guards from several enclosing @supports', async () => {
    const input = `@supports (height: 1dvh) { @supports (width: 1svw) { .a { inset: 1dvh 2svw; } } }`;
    expect(await run(input)).toBe(input);
  });

  it('matches at-rule name and unit case-insensitively', async () => {
    const input = `@SUPPORTS (HEIGHT: 100DVH) { .a { height: 100dvh; } }`;
    expect(await run(input)).toBe(input);
  });

  it('treats :not() inside selector() as part of the selector, not a negation', async () => {
    const input = `@supports selector(:not(a)) and (height: 100dvh) { .a { height: 100dvh; } }`;
    expect(await run(input)).toBe(input);
  });

  it('skips a nested @media twin when the unit is already required', async () => {
    const input = `@supports (height: 1dvh) { @media (min-height: 50dvh) { .a { color: red; } } }`;
    expect(await run(input)).toBe(input);
  });

  it('treats a probe for one built-in unit as proof for the others', async () => {
    const input = `@supports (height: 100dvh) { .a { width: 50svw; inset: 1lvh 2dvmin; } }`;
    expect(await run(input)).toBe(input);
  });

  it('still adds a fallback for a custom unit the query does not require', async () => {
    const out = await run(`@supports (height: 100dvh) { .a { width: 50cqw; } }`, {
      customUnits: { cqw: 'vw' },
    });
    expect(out).toBe(`@supports (height: 100dvh) { .a { width: 50vw; width: 50cqw; } }`);
  });

  it('still adds a fallback when only some units are required', async () => {
    const out = await run(`@supports (height: 1dvh) { .a { inset: 1dvh 2cqw; } }`, {
      customUnits: { cqw: 'vw' },
    });
    expect(out).toBe(
      `@supports (height: 1dvh) { .a { inset: 1vh 2vw; inset: 1dvh 2cqw; } }`
    );
  });

  it('does not let a probe for a custom unit vouch for the built-in ones', async () => {
    const out = await run(
      `@supports (height: 1cqw) { .a { height: 100dvh; width: 1cqw; } }`,
      {
        customUnits: { cqw: 'vw' },
      }
    );
    expect(out).toBe(
      `@supports (height: 1cqw) { .a { height: 100vh; height: 100dvh; width: 1cqw; } }`
    );
  });

  it.each([
    `@supports not (height: 100dvh) { .a { height: 100dvh; } }`,
    `@supports (not (height: 100dvh)) { .a { height: 100dvh; } }`,
    `@supports (height: 100dvh) or (height: 100vh) { .a { height: 100dvh; } }`,
    `@supports (height: 100dvh) OR (display: grid) { .a { height: 100dvh; } }`,
    `@supports (display: grid) { .a { height: 100dvh; } }`,
    `@media (min-height: 1px) { .a { height: 100dvh; } }`,
  ])('still adds a fallback inside %s', async (input) => {
    const out = await run(input);
    expect(out).toContain('height: 100vh; height: 100dvh;');
  });

  it('does not treat a custom-property test as a guard (it is true in every browser)', async () => {
    const out = await run(`@supports (--probe: 100dvh) { .a { height: 100dvh; } }`);
    expect(out).toBe(
      `@supports (--probe: 100dvh) { .a { height: 100vh; height: 100dvh; } }`
    );
  });

  it('only counts units tested through regular properties in a mixed query', async () => {
    const out = await run(
      `@supports (--probe: 1cqh) and (height: 1svh) { .a { inset: 1cqh 2svh; top: 3svh; } }`,
      { customUnits: { cqh: 'vh' } }
    );
    expect(out).toContain('inset: 1vh 2vh; inset: 1cqh 2svh;');
    expect(out).toContain(' top: 3svh;');
    expect(out).not.toContain('top: 3vh');
  });

  it('reads units through grouping parentheses and nested functions', async () => {
    const input = `@supports ((height: 1dvh) and (width: calc(100svw - 1px))) { .a { inset: 1dvh 2svw; } }`;
    expect(await run(input)).toBe(input);
  });

  it('is not fooled by a unit-like substring in the query', async () => {
    const out = await run(`@supports (animation-name: a1dvh) { .a { height: 100dvh; } }`);
    expect(out).toContain('height: 100vh; height: 100dvh;');
  });

  it('throws in strict mode when the query does not guard the unit', async () => {
    await expect(
      process(`@supports not (height: 100dvh) { .a { height: 100dvh; } }`, {
        strict: true,
      })
    ).rejects.toThrow('Dynamic viewport unit found');
  });

  it('applies the css-var strategy only outside guarded blocks', async () => {
    const out = await run(
      `@supports (height: 1dvh) { .a { height: 100dvh; } }\n.b { height: 100dvh; }`,
      { strategy: 'css-var', preserve: false }
    );
    expect(out).toContain('@supports (height: 1dvh) { .a { height: 100dvh; } }');
    expect(out).toContain('.b { height: calc(var(--pvf-dvh, 1vh) * 100); }');
  });

  it('respects customUnits in the guard check', async () => {
    const input = `@supports (height: 1cqh) { .a { height: 100cqh; } }`;
    expect(await run(input, { customUnits: { cqh: 'vh' } })).toBe(input);
  });
});
