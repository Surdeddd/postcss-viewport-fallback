import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

const fixture = (name: string) =>
  resolve(import.meta.dirname, 'fixtures/browserslist', name, 'a.css');
const input = `.a { height: 100dvh; }`;

describe('browserslist: true resolves the targets of every file', () => {
  it('uses the config next to the file, with one plugin instance for all of them', async () => {
    const shared = plugin({ browserslist: true });
    const run = async (from: string | undefined) =>
      (await postcss([shared]).process(input, { from })).css;

    expect(await run(fixture('modern'))).toBe(input);
    expect(await run(fixture('legacy'))).toBe(`.a { height: 100vh; height: 100dvh; }`);
    expect(await run(fixture('modern'))).toBe(input);
    expect(await run(undefined)).toBe(`.a { height: 100vh; height: 100dvh; }`);
  });

  it('keeps custom units working in a directory whose targets support the built-in ones', async () => {
    const result = await postcss([
      plugin({ browserslist: true, customUnits: { cqh: 'vh' } }),
    ]).process(`.a { height: 100dvh; width: 1cqh; }`, { from: fixture('modern') });
    expect(result.css).toBe(`.a { height: 100dvh; width: 1vh; width: 1cqh; }`);
  });

  it('does not look at the file for an explicit query', async () => {
    const result = await postcss([plugin({ browserslist: 'chrome 100' })]).process(
      input,
      {
        from: fixture('modern'),
      }
    );
    expect(result.css).toBe(`.a { height: 100vh; height: 100dvh; }`);
  });
});
