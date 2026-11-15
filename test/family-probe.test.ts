import { describe, it, expect } from 'vitest';
import { run } from './helpers/run';

describe('one @supports probe stands for all built-in viewport units', () => {
  it('guards any built-in unit with the dvh probe', async () => {
    const out = await run(`.a { width: calc(100svw - var(--x)); }`);
    expect(out).toBe(`.a { width: calc(100vw - var(--x)); }
@supports (height: 1dvh) { .a { width: calc(100svw - var(--x)); } }`);
  });

  it('puts declarations with different built-in units into one block', async () => {
    const out = await run(
      `.modal { max-height: calc(100dvh - var(--p)); max-width: calc(100dvw - var(--p)); }`
    );
    expect(out)
      .toBe(`.modal { max-height: calc(100vh - var(--p)); max-width: calc(100vw - var(--p)); }
@supports (height: 1dvh) { .modal { max-height: calc(100dvh - var(--p)); max-width: calc(100dvw - var(--p)); } }`);
    expect(await run(out)).toBe(out);
  });

  it('does the same for custom properties', async () => {
    const out = await run(`:root { --h: 100dvh; --w: 100svw; --m: 5lvmin; }`, {
      includeCustomProps: true,
    });
    expect(out).toBe(`:root { --h: 100vh; --w: 100vw; --m: 5vmin; }
@supports (height: 1dvh) { :root { --h: 100dvh; --w: 100svw; --m: 5lvmin; } }`);
  });

  it.each([
    `@supports (height: 100dvh) { .a { width: 50svw; min-height: calc(100lvh - var(--x)); } }`,
    `@supports (width: 1svw) { @media (min-height: 50dvh) { .a { height: 100lvh; } } }`,
  ])(
    'treats a probe for one built-in unit as proof for the others: %s',
    async (input) => {
      expect(await run(input, { includeCustomProps: true })).toBe(input);
    }
  );

  it('keeps a separate probe for a custom unit', async () => {
    const out = await run(`.a { height: calc(100cqh - var(--x)); }`, {
      customUnits: { cqh: 'svh' },
    });
    expect(out).toBe(`.a { height: calc(100vh - var(--x)); }
@supports (height: 1dvh) { .a { height: calc(100svh - var(--x)); } }
@supports (height: 1cqh) { .a { height: calc(100cqh - var(--x)); } }`);
  });

  it('does not let a built-in probe vouch for a custom unit', async () => {
    const out = await run(`@supports (height: 1dvh) { .a { height: 100cqh; } }`, {
      customUnits: { cqh: 'svh' },
    });
    expect(out).toBe(
      `@supports (height: 1dvh) { .a { height: 100svh; height: 100cqh; } }`
    );
  });

  it('takes a built-in unit that customUnits remaps out of the shared probe', async () => {
    const out = await run(
      `.a { height: calc(1dvh - var(--x)); width: calc(1lvw - var(--x)); }`,
      {
        customUnits: { dvh: 'svh' },
      }
    );
    expect(out).toBe(`.a { height: calc(1vh - var(--x)); width: calc(1vw - var(--x)); }
@supports (height: 1dvw) { .a { height: calc(1svh - var(--x)); } }
@supports (height: 1dvh) { .a { height: calc(1dvh - var(--x)); } }
@supports (height: 1dvw) { .a { width: calc(1lvw - var(--x)); } }`);
  });
});

describe('the css-var seed upgrades every built-in unit in one block', () => {
  it('lists the units together', async () => {
    const out = await run(`.a { height: 100dvh; width: 50svw; }`, {
      strategy: 'css-var',
      preserve: false,
    });
    expect(out).toBe(`:root, :host { --pvf-dvh: 1vh; --pvf-svw: 1vw }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh; --pvf-svw: 1svw } }
.a { height: calc(var(--pvf-dvh, 1vh) * 100); width: calc(var(--pvf-svw, 1vw) * 50); }`);
  });

  it('keeps one block per step of a custom chain', async () => {
    const out = await run(`.a { height: 1cqh; width: 1dvw; }`, {
      strategy: 'css-var',
      preserve: false,
      customUnits: { cqh: 'svh' },
    });
    expect(out).toBe(`:root, :host { --pvf-cqh: 1vh; --pvf-dvw: 1vw }
@supports (height: 1dvh) { :root, :host { --pvf-cqh: 1svh; --pvf-dvw: 1dvw } }
@supports (height: 1cqh) { :root, :host { --pvf-cqh: 1cqh } }
.a { height: calc(var(--pvf-cqh, 1vh) * 1); width: calc(var(--pvf-dvw, 1vw) * 1); }`);
  });

  it('tops up a seed written with one block per unit', async () => {
    const out = await run(
      `:root, :host { --pvf-dvh: 1vh }\n@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }\n.a { height: calc(var(--pvf-dvh, 1vh) * 100); width: 1svw; }`,
      { strategy: 'css-var', preserve: false }
    );
    expect((out.match(/--pvf-dvh: 1vh/g) ?? []).length).toBe(1);
    expect(out).toContain(`:root, :host { --pvf-svw: 1vw }
@supports (height: 1dvh) { :root, :host { --pvf-svw: 1svw } }`);
  });
});
