import { describe, it, expect } from 'vitest';
import { run } from './helpers/run';

describe('dedup compares importance and property case', () => {
  it('adds an important fallback when only a normal-priority one exists', async () => {
    const out = await run(`.a { height: 100vh; height: 100dvh !important; }`);
    expect(out).toBe(
      `.a { height: 100vh; height: 100vh !important; height: 100dvh !important; }`
    );
  });

  it('skips when an equally important fallback already exists', async () => {
    const input = `.a { height: 100vh !important; height: 100dvh !important; }`;
    expect(await run(input)).toBe(input);
  });

  it('is idempotent after adding the important fallback', async () => {
    const first = await run(`.a { height: 100vh; height: 100dvh !important; }`);
    expect(await run(first)).toBe(first);
  });

  it('matches regular property names case-insensitively', async () => {
    const input = `.a { HEIGHT: 100vh; height: 100dvh; }`;
    expect(await run(input)).toBe(input);
  });

  it('removes the original on an important dedup hit with preserve: false', async () => {
    const out = await run(`.a { height: 100vh !important; height: 100dvh !important; }`, {
      preserve: false,
    });
    expect(out).toBe(`.a { height: 100vh !important; }`);
  });
});
