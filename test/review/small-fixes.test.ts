import { describe, it, expect } from 'vitest';
import plugin from '../../src';
import type { ViewportFallbackOptions } from '../../src';
import { run, process } from '../helpers/run';

const invalid = (options: unknown) => () => plugin(options as ViewportFallbackOptions);

describe('customUnits fallback validation', () => {
  it.each(['v%', '%%', '%px', 'px%'])('rejects the malformed fallback %s', (fallback) => {
    expect(invalid({ customUnits: { cqh: fallback } })).toThrow(
      /invalid customUnits fallback/
    );
  });

  it('still accepts a plain percent sign and plain unit names', async () => {
    expect(await run(`.a { height: 1cqh; }`, { customUnits: { cqh: '%' } })).toBe(
      `.a { height: 1%; height: 1cqh; }`
    );
  });
});

describe('values and preludes with CSS escapes are left alone', () => {
  it.each([
    `a{animation-name:foo\\ 100dvh}`,
    `a{animation-name:\\31 00dvh}`,
    `a{background:u\\72l(100dvh)}`,
    `a{height:100dvh\\9}`,
    `@container card\\.x (width > 100dvw){a{color:red}}`,
  ])('does not touch %s', async (input) => {
    expect(await run(input)).toBe(input);
    expect(await run(input, { preserve: false })).toBe(input);
    expect(await run(input, { strategy: 'css-var' })).toBe(input);
  });

  it('does not treat an @supports prelude with escapes as a guard', async () => {
    const out = await run(`@supports n\\6ft (height:1dvh){a{height:100dvh}}`);
    expect(out).toBe(`@supports n\\6ft (height:1dvh){a{height:100vh;height:100dvh}}`);
  });
});

describe('container style queries compare tokens and are not rewritten', () => {
  it('leaves style() conditions alone', async () => {
    const input = `.host{--h:100vh}\n@container style(--h:100dvh){.child{color:red}}`;
    expect(await run(input)).toBe(input);
  });

  it('still twins the size part of a mixed container query', async () => {
    const out = await run(
      `@container card (width > 50dvw) and style(--h: 100dvh) { .a { color: red; } }`
    );
    expect(out).toContain('@container card (width > 50vw) and style(--h: 100dvh)');
    expect(out).toContain('@container card (width > 50dvw) and style(--h: 100dvh)');
  });
});

describe('@supports guard inference', () => {
  it.each([
    `@supports (height:var(--x,1dvh)){a{height:100dvh}}`,
    `@supports (height: calc(1dvh + env(safe-area-inset-top))) {a{height:100dvh}}`,
    `@supports (height: 100dvh)/**/or/**/(height: 100vh) {a{height:100dvh}}`,
    `@supports (height: 100dvh) /* c */ or (display: grid) {a{height:100dvh}}`,
    `@supports not/**/(height: 100dvh) {a{height:100dvh}}`,
  ])('does not treat %s as proof of unit support', async (input) => {
    const out = await run(input);
    expect(out).toContain('height:100vh;height:100dvh');
  });

  it('still recognises a plain positive test next to comments', async () => {
    const input = `@supports /* modern */ (height: 100dvh) { a { height: 100dvh; } }`;
    expect(await run(input)).toBe(input);
  });
});

describe('at-rule twins are matched by content, not only by prelude', () => {
  const input = `@media (min-height: 50vh) { .hero { padding: 2rem } }
@media (min-height: 50dvh) { .footer { position: sticky } }`;

  it('adds the fallback when the neighbour with the fallback prelude has other content', async () => {
    const out = await run(input);
    expect(out).toBe(`@media (min-height: 50vh) { .hero { padding: 2rem } }
@media (min-height: 50vh), (min-height: 50dvh) { .footer { position: sticky } }`);
  });

  it('adds a @container twin when the neighbour has other content', async () => {
    const out = await run(input.replace(/@media/g, '@container'));
    expect(out).toBe(`@container (min-height: 50vh) { .hero { padding: 2rem } }
@container (min-height: 50vh) { .footer { position: sticky } }
@container (min-height: 50dvh) { .footer { position: sticky } }`);
  });

  it('never drops a block with preserve: false', async () => {
    const out = await run(input, { preserve: false });
    expect(out).toBe(`@media (min-height: 50vh) { .hero { padding: 2rem } }
@media (min-height: 50vh) { .footer { position: sticky } }`);
  });

  it('still reuses an identical neighbour, ignoring whitespace differences', async () => {
    const twin = `@media (min-height: 50vh) { .a{color:red} }\n@media (min-height: 50dvh) { .a { color: red } }`;
    expect(await run(twin)).toBe(twin);
    expect(await run(twin, { preserve: false })).toBe(
      `@media (min-height: 50vh) { .a{color:red} }`
    );
  });

  it('compares importance and body-less statements inside the blocks', async () => {
    const twin = `@media (min-height: 50vh) { @layer base; .a { color: red !important } }
@media (min-height: 50dvh) { @layer base; .a { color: red !important } }`;
    expect(await run(twin)).toBe(twin);

    const different = `@media (min-height: 50vh) { .a { color: red } }
@media (min-height: 50dvh) { .a { color: red !important } }`;
    expect(await run(different)).toBe(`@media (min-height: 50vh) { .a { color: red } }
@media (min-height: 50vh), (min-height: 50dvh) { .a { color: red !important } }`);
  });

  it('stays idempotent for blocks that contain transformed declarations', async () => {
    const first = await run(
      `@media (min-height: 50dvh) { .a { height: 100dvh; --x: 1dvh; } }`,
      {
        includeCustomProps: true,
      }
    );
    expect(await run(first, { includeCustomProps: true })).toBe(first);
  });
});

describe('a long chain of customUnits', () => {
  it('is lowered to its end', async () => {
    const customUnits: Record<string, string> = {};
    const names = Array.from(
      { length: 30 },
      (_, i) => 'u' + String.fromCharCode(97 + (i % 26)) + (i > 25 ? 'x' : '')
    );
    names.forEach((name, i) => (customUnits[name] = names[i + 1] ?? 'vh'));
    const out = await run(`a{height:1${names[0]}}`, { customUnits });
    expect(out.match(/height:/g)).toHaveLength(31);
  });
});

describe('strict mode throws only where a fallback would be added or is impossible', () => {
  it('accepts a declaration whose fallback already exists', async () => {
    const input = `.a { height: 100vh; height: 100dvh; }`;
    expect(await run(input, { strict: true })).toBe(input);
  });

  it('accepts an at-rule whose twin already exists', async () => {
    const input = `@media (min-height: 50vh) {} @media (min-height: 50dvh) {}`;
    expect(await run(input, { strict: true })).toBe(input);
  });

  it('accepts a custom property that a later declaration overrides', async () => {
    const input = `.a { --h: 100dvh; --h: 5px; }`;
    expect(await run(input, { strict: true, includeCustomProps: true })).toBe(input);
  });

  it('throws where no fallback is possible', async () => {
    await expect(
      process(`@keyframes k { to { --h: 100dvh; } }`, {
        strict: true,
        includeCustomProps: true,
      })
    ).rejects.toThrow('Dynamic viewport unit found: --h: 100dvh');
  });
});
