import { describe, it, expect } from 'vitest';
import { run } from './helpers/run';

describe('@supports conditions with not, and, or', () => {
  it.each([
    ['(height: 1dvh)', true],
    ['((height: 1dvh))', true],
    ['not (not (height: 1dvh))', true],
    ['(height: 1dvh) or (height: 1svh)', true],
    ['(height: 1dvh) or (width: 1lvw) or (inset: 1dvi)', true],
    ['(display: grid) and (not (not (width: 1svw)))', true],
    ['not ((display: grid) or (not (height: 1dvh)))', true],
    ['selector(:has(a)) and (height: 1dvh)', true],
    ['(height: 1dvh) and (display: grid) and (color: red)', true],
    ['(height: 1dvh) or (display: grid)', false],
    ['not (height: 1dvh)', false],
    ['not ((height: 1dvh) and (display: grid))', false],
    ['not ((not (height: 1dvh)) and (display: grid))', false],
    ['(display: grid) or (not (not (height: 1dvh)))', false],
    ['selector(:has(a)) or (height: 1dvh)', false],
  ] as const)('%s proves the unit: %s', async (condition, proven) => {
    const input = `@supports ${condition} { .a { height: 100dvh; } }`;
    const expected = proven
      ? input
      : `@supports ${condition} { .a { height: 100vh; height: 100dvh; } }`;
    expect(await run(input)).toBe(expected);
  });

  it.each([
    '(height: 1dvh) and (display: grid) or (color: red)',
    '(height: 1dvh) and',
    'and (height: 1dvh)',
    'not (height: 1dvh) and (width: 1dvw)',
    'not',
    '(height: 1dvh) (width: 1dvw)',
  ])('takes nothing for proven by the malformed %s', async (condition) => {
    const input = `@supports ${condition} { .a { height: 100dvh; } }`;
    expect(await run(input)).toBe(
      `@supports ${condition} { .a { height: 100vh; height: 100dvh; } }`
    );
  });

  it('keeps the probes of custom units apart inside or', async () => {
    const options = { customUnits: { cqh: 'vh' } };
    const either = `@supports (height: 1cqh) or (height: 1dvh) { .a { height: 100dvh; } }`;
    expect(await run(either, options)).toBe(
      `@supports (height: 1cqh) or (height: 1dvh) { .a { height: 100vh; height: 100dvh; } }`
    );
    const both = `@supports (height: 1cqh) and (height: 1dvh) { .a { height: 1cqh; width: 1dvw; } }`;
    expect(await run(both, options)).toBe(both);
  });

  it('applies the same reading to values with var()', async () => {
    const input = `@supports not (not (height: 1dvh)) { .a { height: calc(100dvh - var(--x)); } }`;
    expect(await run(input)).toBe(input);
  });
});
