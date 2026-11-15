import { describe, it, expect } from 'vitest';
import plugin from '../src';
import type { TransformStats, ViewportFallbackOptions } from '../src';
import { run } from './helpers/run';

const any = { existingFallback: 'any' } as const;

describe('existingFallback: "any" accepts whatever the author wrote before', () => {
  it('adds a twin after another value by default', async () => {
    expect(await run(`.a { height: 500px; height: 100dvh; }`)).toBe(
      `.a { height: 500px; height: 100vh; height: 100dvh; }`
    );
  });

  it('leaves the declaration alone when an earlier value of the property exists', async () => {
    let stats: TransformStats | undefined;
    const input = `.a { height: 500px; /* note */ --x: 1; height: 100dvh; }`;
    expect(await run(input, { ...any, onComplete: (s) => (stats = s) })).toBe(input);
    expect(stats).toMatchObject({ declarations: 0, skipped: 1 });
  });

  it('accepts a value with var() as the author’s fallback', async () => {
    const input = `.a { height: var(--h); height: 100dvh; }`;
    expect(await run(input, any)).toBe(input);
  });

  it.each([
    [
      `.a { height: 500px; block-size: 0; height: 100dvh; }`,
      `height: 500px; block-size: 0; height: 100vh; height: 100dvh;`,
    ],
    [
      `.a { height: 500px !important; height: 100dvh; }`,
      `height: 500px !important; height: 100vh; height: 100dvh;`,
    ],
    [
      `.a { height: 50svh; height: 100dvh; }`,
      `height: 50vh; height: 50svh; height: 100vh; height: 100dvh;`,
    ],
    [
      `.a { height: 100dvh; height: 500px; }`,
      `height: 100vh; height: 100dvh; height: 500px;`,
    ],
  ])('still adds a twin in %s', async (input, body) => {
    expect(await run(input, any)).toBe(`.a { ${body} }`);
  });

  it.each(['_', '*'])(
    'does not take a declaration behind the %s hack for a fallback',
    async (hack) => {
      expect(await run(`.a { ${hack}height: 100vh; height: 100dvh; }`)).toBe(
        `.a { ${hack}height: 100vh; height: 100vh; height: 100dvh; }`
      );
      expect(
        await run(`.a { ${hack}height: 5px; color: red; height: 100dvh; }`, any)
      ).toBe(`.a { ${hack}height: 5px; color: red; height: 100vh; height: 100dvh; }`);
      expect(await run(`.a { height: 100dvh; ${hack}height: 100vh; }`)).toBe(
        `.a { height: 100vh; height: 100dvh; ${hack}height: 100vh; }`
      );
    }
  );

  it('looks past a hacked declaration for the fallback before it', async () => {
    const input = `.a { height: 100vh; _height: 1px; height: 100dvh; }`;
    expect(await run(input)).toBe(input);
  });

  it('looks past a hacked shorthand of the property as well', async () => {
    const input = `.a { margin-top: 5vh; _margin: 0; margin-top: 5dvh; }`;
    expect(await run(input)).toBe(input);
  });

  it('takes a hacked fallback for a declaration behind the same hack', async () => {
    const input = `.a { _height: 100vh; _height: 100dvh; }`;
    expect(await run(input)).toBe(input);
  });

  it('removes the modern declaration with preserve: false', async () => {
    expect(
      await run(`.a { height: 500px; height: 100dvh; }`, { ...any, preserve: false })
    ).toBe(`.a { height: 500px; }`);
  });

  it('is idempotent', async () => {
    const first = await run(`.a { height: 500px; height: 100dvh; width: 1dvw; }`, any);
    expect(await run(first, any)).toBe(first);
  });

  it('rejects anything else', () => {
    expect(() =>
      plugin({ existingFallback: 'none' } as unknown as ViewportFallbackOptions)
    ).toThrow(
      /invalid option "existingFallback": expected "exact" or "any", received "none"/
    );
  });
});
