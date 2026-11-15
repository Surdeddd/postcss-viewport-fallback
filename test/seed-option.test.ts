import { describe, it, expect } from 'vitest';
import plugin from '../src';
import type { ViewportFallbackOptions } from '../src';
import { process, run } from './helpers/run';

const shared = { strategy: 'css-var', seed: false } as const;

describe('seed: false leaves the --pvf-* seed to a stylesheet you ship yourself', () => {
  it('rewrites the values and writes no seed', async () => {
    expect(await run(`.a{height:1dvh}`, { ...shared, preserve: false })).toBe(
      `.a{height:calc(var(--pvf-dvh, 1vh) * 1)}`
    );
  });

  it('does not complain that a fragment has no place for the seed', async () => {
    const result = await process(`height: 100dvh;`, shared);
    expect(result.css).toBe(`height: calc(var(--pvf-dvh, 1vh) * 100);height: 100dvh;`);
    expect(result.warnings()).toHaveLength(0);
  });

  it('still writes the seed by default', async () => {
    expect(await run(`.a{height:1dvh}`, { strategy: 'css-var' })).toContain(
      '--pvf-dvh: 1vh'
    );
  });

  it('rejects a value that is not a boolean', () => {
    expect(() => plugin({ seed: 'no' } as unknown as ViewportFallbackOptions)).toThrow(
      /invalid option "seed"/
    );
  });
});
