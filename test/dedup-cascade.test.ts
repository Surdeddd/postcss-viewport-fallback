import { describe, it, expect } from 'vitest';
import { run } from './helpers/run';

describe('an existing fallback counts only where it holds the same cascade position', () => {
  it('adds a twin when another property sits between the fallback and the declaration', async () => {
    const out = await run(`.a { margin-top: 5vmin; margin: 1px; margin-top: 5svmin; }`);
    expect(out).toBe(
      `.a { margin-top: 5vmin; margin: 1px; margin-top: 5vmin; margin-top: 5svmin; }`
    );
    expect(await run(out)).toBe(out);
  });

  it('keeps the fallback in place of a repeated declaration with preserve: false', async () => {
    const out = await run(`.a { margin-top: 5svmin; margin: 1px; margin-top: 5svmin; }`, {
      preserve: false,
    });
    expect(out).toBe(`.a { margin-top: 5vmin; margin: 1px; margin-top: 5vmin; }`);
  });

  it('does the same for the css-var strategy', async () => {
    const out = await run(`.a { margin-top: 5svmin; margin: 1px; margin-top: 5svmin; }`, {
      preserve: false,
      strategy: 'css-var',
    });
    expect(out).toContain(
      `.a { margin-top: calc(var(--pvf-svmin, 1vmin) * 5); margin: 1px; margin-top: calc(var(--pvf-svmin, 1vmin) * 5); }`
    );
  });

  it('does not mistake its own twin of an earlier declaration for a hand-written ladder', async () => {
    const out = await run(`.a { height: 100dvh; height: 12px; height: 100dvh; }`);
    expect(out).toBe(
      `.a { height: 100vh; height: 100dvh; height: 12px; height: 100vh; height: 100dvh; }`
    );
    expect(await run(out)).toBe(out);
  });

  it('adds a twin when a nested block sits between the fallback and the declaration', async () => {
    const out = await run(`.a { height: 100vh; & .b { color: red; } height: 100dvh; }`);
    expect(out).toBe(
      `.a { height: 100vh; & .b { color: red; } height: 100vh; height: 100dvh; }`
    );
  });
});

describe('an existing fallback is still recognised', () => {
  it.each([
    `.a { height: 100vh; height: 100dvh; }`,
    `.a { height: 100vh; /* note */ height: 100dvh; }`,
    `.a { height: 100vh; --gap: 4px; height: 100dvh; }`,
    `.a { height: 100vh; HEIGHT: 100dvh; }`,
    `.a { min-height: 100vh; min-height: -webkit-fill-available; min-height: 100dvh; }`,
    `.a { height: 100vh; height: 100svh; height: 100dvh; }`,
    `.a { height: 100dvh; color: red; height: 100vh; }`,
  ])('%s', async (input) => {
    expect(await run(input)).toBe(input);
  });

  it('twins a repeated declaration once', async () => {
    expect(await run(`.a { height: 100dvh; height: 100dvh; }`)).toBe(
      `.a { height: 100vh; height: 100dvh; height: 100dvh; }`
    );
    expect(await run(`.a { height: 100dvh; height: 100dvh; }`, { preserve: false })).toBe(
      `.a { height: 100vh; }`
    );
  });

  it('removes a declaration that a later fallback overrides, with preserve: false', async () => {
    expect(
      await run(`.a { height: 100dvh; margin: 0; height: 100vh; }`, { preserve: false })
    ).toBe(`.a { margin: 0; height: 100vh; }`);
  });
});
