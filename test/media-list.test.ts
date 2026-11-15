import { describe, it, expect } from 'vitest';
import type { TransformMeta, TransformStats } from '../src';
import { process, run, warningsOf } from './helpers/run';

describe('@media gets its fallback as one more query in the list', () => {
  it('adds the lowered query in front of the original', async () => {
    expect(await run(`@media (min-height: 100dvh) { .a { color: red; } }`)).toBe(
      `@media (min-height: 100vh), (min-height: 100dvh) { .a { color: red; } }`
    );
  });

  it('does not copy the block', async () => {
    let stats: TransformStats | undefined;
    const out = await run(`@media (min-height: 50dvh) { .a { height: 100dvh; } }`, {
      onComplete: (s) => (stats = s),
    });
    expect(out).toBe(
      `@media (min-height: 50vh), (min-height: 50dvh) { .a { height: 100vh; height: 100dvh; } }`
    );
    expect(stats).toMatchObject({ atRules: 1, declarations: 1, skipped: 0 });
  });

  it('lowers each query of a list on its own', async () => {
    expect(
      await run(
        `@media screen and (min-height: 50dvh), print, (max-width: 10svw) { a { b: c } }`
      )
    ).toBe(
      `@media screen and (min-height: 50vh), screen and (min-height: 50dvh), print, (max-width: 10vw), (max-width: 10svw) { a { b: c } }`
    );
  });

  it('keeps a compact prelude compact', async () => {
    expect(await run(`@media (min-height:100dvh){a{b:c}}`)).toBe(
      `@media (min-height:100vh),(min-height:100dvh){a{b:c}}`
    );
  });

  it.each([
    [
      `@media (height >= 100dvh) { a { b: c } }`,
      `@media (height >= 100vh), (height >= 100dvh)`,
    ],
    [
      `@MEDIA (MIN-HEIGHT: 50DVH) { a { b: c } }`,
      `@MEDIA (MIN-HEIGHT: 50vh), (MIN-HEIGHT: 50DVH)`,
    ],
    [
      `@media not screen and (min-height: 1dvh) { a { b: c } }`,
      `@media not screen and (min-height: 1vh), not screen and (min-height: 1dvh)`,
    ],
  ])('handles %s', async (input, prelude) => {
    expect(await run(input)).toContain(prelude + ' {');
  });

  it('writes every step of a customUnits chain', async () => {
    expect(
      await run(`@media (min-height: 1cqh) { a { b: c } }`, {
        customUnits: { cqh: 'svh' },
      })
    ).toBe(
      `@media (min-height: 1vh), (min-height: 1svh), (min-height: 1cqh) { a { b: c } }`
    );
  });

  it('is idempotent and recognises a list written by hand', async () => {
    const first = await run(
      `@media (min-height: 50dvh), print { a { b: c } }\n@media (min-height: 1cqh) { a { b: c } }`,
      { customUnits: { cqh: 'svh' } }
    );
    expect(await run(first, { customUnits: { cqh: 'svh' } })).toBe(first);

    let stats: TransformStats | undefined;
    const manual = `@media (MIN-HEIGHT:  50vh), (min-height: 50dvh) { a { b: c } }`;
    expect(await run(manual, { onComplete: (s) => (stats = s) })).toBe(manual);
    expect(stats).toMatchObject({ atRules: 0, skipped: 1 });
  });

  it('works for a nested @media', async () => {
    expect(await run(`.a { @media (min-height: 50dvh) { color: red; } }`)).toBe(
      `.a { @media (min-height: 50vh), (min-height: 50dvh) { color: red; } }`
    );
  });
});

describe('@media with preserve: false', () => {
  it('replaces the queries', async () => {
    expect(
      await run(`@media screen and (min-height: 50dvh), print { a { b: c } }`, {
        preserve: false,
      })
    ).toBe(`@media screen and (min-height: 50vh), print { a { b: c } }`);
  });

  it('does not repeat a query that is already there', async () => {
    expect(
      await run(`@media (min-height: 50vh), (min-height: 50dvh) { a { b: c } }`, {
        preserve: false,
      })
    ).toBe(`@media (min-height: 50vh) { a { b: c } }`);
  });

  it('lowers a customUnits chain all the way', async () => {
    expect(
      await run(`@media (min-height: 1cqh) { a { b: c } }`, {
        preserve: false,
        customUnits: { cqh: 'svh' },
      })
    ).toBe(`@media (min-height: 1vh) { a { b: c } }`);
  });
});

describe('@media: what leaves it alone, and what is reported', () => {
  it.each([
    `@supports (height: 1dvh) { @media (min-height: 50dvh) { a { b: c } } }`,
    `/* postcss-viewport-fallback: off */ @media (min-height: 50dvh) { a { b: c } }`,
    `@media (min-width: 100px), print { a { b: c } }`,
    `@media (min-height: 50dvh\\9) { a { b: c } }`,
  ])('leaves %s', async (input) => {
    expect(await run(input)).toBe(input);
  });

  it('honours property filters under the name @media', async () => {
    const input = `@media (min-height: 50dvh) { a { height: 1dvh } }`;
    expect(await run(input, { excludeProperties: '@media' })).toBe(
      `@media (min-height: 50dvh) { a { height: 1vh; height: 1dvh } }`
    );
    expect(await run(input, { onlyProperties: '@media' })).toBe(
      `@media (min-height: 50vh), (min-height: 50dvh) { a { height: 1dvh } }`
    );
  });

  it('throws in strict mode, but not for a list that already has the fallback', async () => {
    await expect(
      process(`@media (min-height: 50dvh) { a { b: c } }`, { strict: true })
    ).rejects.toThrow('Dynamic viewport unit found: @media (min-height: 50dvh)');
    const manual = `@media (min-height: 50vh), (min-height: 50dvh) { a { b: c } }`;
    expect(await run(manual, { strict: true })).toBe(manual);
  });

  it('reports the transform once', async () => {
    const metas: TransformMeta[] = [];
    await run(`.x { @media (min-height: 50dvh), print { color: red; } }`, {
      onTransform: (meta) => metas.push(meta),
    });
    expect(metas).toEqual([
      expect.objectContaining({
        prop: '@media',
        original: '(min-height: 50dvh), print',
        fallback: '(min-height: 50vh), print',
        selector: '.x',
      }),
    ]);
    const logs = await warningsOf(`@media (min-height: 50dvh) { a { b: c } }`, {
      debug: true,
    });
    expect(logs.filter((text) => text.includes('→'))).toEqual([
      '@media: (min-height: 50dvh) → (min-height: 50vh)',
    ]);
  });
});

describe('media conditions outside @media', () => {
  it('lowers the media part of @import', async () => {
    expect(await run(`@import url("tall.css") screen and (min-height: 100dvh);`)).toBe(
      `@import url("tall.css") screen and (min-height: 100vh), screen and (min-height: 100dvh);`
    );
    expect(await run(`@import "tall.css" (min-height: 100dvh);`)).toBe(
      `@import "tall.css" (min-height: 100vh), (min-height: 100dvh);`
    );
  });

  it('leaves the url, layer() and supports() parts of @import alone', async () => {
    expect(
      await run(
        `@import url(100dvh.css) layer(base) supports(height: 100dvh) (min-height: 100dvh);`
      )
    ).toBe(
      `@import url(100dvh.css) layer(base) supports(height: 100dvh) (min-height: 100vh), (min-height: 100dvh);`
    );
    const plain = `@import "100dvh.css" layer supports(height: 100dvh);`;
    expect(await run(plain)).toBe(plain);
  });

  it('lowers @custom-media definitions', async () => {
    expect(await run(`@custom-media --tall (min-height: 100dvh);`)).toBe(
      `@custom-media --tall (min-height: 100vh), (min-height: 100dvh);`
    );
    const flag = `@custom-media --100dvh true;`;
    expect(await run(flag)).toBe(flag);
  });

  it('filters them under their own names', async () => {
    const input = `@import "a.css" (min-height: 1dvh);\n@custom-media --t (min-height: 1dvh);`;
    expect(await run(input, { excludeProperties: ['@import', '@custom-media'] })).toBe(
      input
    );
  });

  it('replaces them with preserve: false', async () => {
    expect(
      await run(
        `@import "a.css" (min-height: 1dvh);\n@custom-media --t (min-height: 1dvh);`,
        {
          preserve: false,
        }
      )
    ).toBe(`@import "a.css" (min-height: 1vh);\n@custom-media --t (min-height: 1vh);`);
  });
});

describe('@container still gets a twin block', () => {
  it('duplicates the rule, because lists of container conditions are not widely supported', async () => {
    expect(await run(`@container card (width > 50dvw) { .a { color: red; } }`)).toBe(
      `@container card (width > 50vw) { .a { color: red; } } @container card (width > 50dvw) { .a { color: red; } }`
    );
  });
});
