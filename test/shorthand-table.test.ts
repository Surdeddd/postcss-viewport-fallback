import { describe, it, expect } from 'vitest';
import { run, warningsOf } from './helpers/run';

const guard = (body: string): string => `@supports (height: 1dvh){.a{${body}}}`;

describe('declarations repeated next to a guarded value', () => {
  it.each([
    [
      'only the ones that can meet it',
      `.a{height:calc(100dvh - var(--h));display:flex;color:red}`,
      `.a{height:calc(100vh - var(--h));display:flex;color:red}` +
        guard(`height:calc(100dvh - var(--h))`),
    ],
    [
      'a shorthand of it and what that shorthand reaches in turn',
      `.a{margin-top:var(--x,1dvh);margin:5px;margin-left:3px;color:red}`,
      `.a{margin-top:var(--x,1vh);margin:5px;margin-left:3px;color:red}` +
        guard(`margin-top:var(--x,1dvh);margin:5px;margin-left:3px`),
    ],
    [
      'a flow-relative property, whatever side it turns out to mean',
      `.a{top:var(--x,1dvh);inset-inline-start:0;width:5px}`,
      `.a{top:var(--x,1vh);inset-inline-start:0;width:5px}` +
        guard(`top:var(--x,1dvh);inset-inline-start:0`),
    ],
    [
      'everything after a property the table does not know',
      `.a{top:var(--x,1dvh);color:red;frobnicate:1;width:5px}`,
      `.a{top:var(--x,1vh);color:red;frobnicate:1;width:5px}` +
        guard(`top:var(--x,1dvh);frobnicate:1;width:5px`),
    ],
    [
      'everything after `all`',
      `.a{top:var(--x,1dvh);color:red;all:unset;width:5px}`,
      `.a{top:var(--x,1vh);color:red;all:unset;width:5px}` +
        guard(`top:var(--x,1dvh);all:unset;width:5px`),
    ],
    [
      'everything, when the guarded property itself is unknown',
      `.a{frobnicate:var(--x,1dvh);color:red}`,
      `.a{frobnicate:var(--x,1vh);color:red}` +
        guard(`frobnicate:var(--x,1dvh);color:red`),
    ],
    [
      'a prefixed spelling of the same property',
      `.a{user-select:var(--u,1dvh);-moz-user-select:none;color:red}`,
      `.a{user-select:var(--u,1vh);-moz-user-select:none;color:red}` +
        guard(`user-select:var(--u,1dvh);-moz-user-select:none`),
    ],
    [
      'names written with escapes or capitals',
      `.a{m\\61rgin:var(--x,1dvh);MARGIN-TOP:0;PADDING:0}`,
      `.a{m\\61rgin:var(--x,1vh);MARGIN-TOP:0;PADDING:0}` +
        guard(`m\\61rgin:var(--x,1dvh);MARGIN-TOP:0`),
    ],
    [
      'never a custom property',
      `.a{top:var(--x,1dvh);--top:1px;inset:0}`,
      `.a{top:var(--x,1vh);--top:1px;inset:0}` + guard(`top:var(--x,1dvh);inset:0`),
    ],
  ])('are %s', async (_, input, expected) => {
    expect(await run(input)).toBe(expected);
  });

  it('stay in source order when several guarded values share one block', async () => {
    const input =
      `.a{border-top-width:var(--x,1dvh);border-right-width:var(--x,2dvh);` +
      `border-right-color:var(--c,3dvh);border-color:red;border-right:0;border-top:0;width:5px}`;
    expect(await run(input)).toBe(
      `.a{border-top-width:var(--x,1vh);border-right-width:var(--x,2vh);` +
        `border-right-color:var(--c,3vh);border-color:red;border-right:0;border-top:0;width:5px}` +
        guard(
          `border-top-width:var(--x,1dvh);border-right-width:var(--x,2dvh);` +
            `border-right-color:var(--c,3dvh);border-color:red;border-right:0;border-top:0`
        )
    );
  });

  it('stand before the twin of a later copy, never between the two', async () => {
    const css = await run(
      `.a{@media all{margin-top:var(--x,1cqw);margin-left:var(--z,2cqw);margin:4svw}}`,
      { customUnits: { cqw: 'vw' } }
    );
    expect(css).toBe(
      `.a{@media all{margin-top:var(--x,1vw);margin-left:var(--z,2vw);` +
        `@supports (height: 1cqw){margin-top:var(--x,1cqw);margin-left:var(--z,2cqw);margin:4vw;margin:4svw}` +
        `margin:4vw;margin:4svw}}`
    );
  });

  it('are repeated in every block of a chain of units', async () => {
    const css = await run(`.a{top:var(--x,1cqh);inset:0;color:red}`, {
      customUnits: { cqh: 'svh' },
    });
    expect(css).toBe(
      `.a{top:var(--x,1vh);inset:0;color:red}` +
        `@supports (height: 1dvh){.a{top:var(--x,1svh);inset:0}}` +
        `@supports (height: 1cqh){.a{top:var(--x,1cqh);inset:0}}`
    );
  });

  it('wait for their own fallback when they are guarded in another block', async () => {
    const css = await run(`.a{top:var(--x,1dvh);inset:var(--y,2cqw);color:red}`, {
      customUnits: { cqw: 'vw' },
    });
    expect(css).toBe(
      `.a{top:var(--x,1vh);inset:var(--y,2vw);color:red}` +
        `@supports (height: 1dvh){.a{top:var(--x,1dvh);inset:var(--y,2vw)}}` +
        `@supports (height: 1cqw){.a{inset:var(--y,2cqw)}}`
    );
  });
});

describe('where the block goes', () => {
  it('is after the rule when the nested blocks set nothing that can meet it', async () => {
    expect(await run(`.a{height:calc(100dvh - var(--h));&:hover{color:blue}}`)).toBe(
      `.a{height:calc(100vh - var(--h));&:hover{color:blue}}` +
        guard(`height:calc(100dvh - var(--h))`)
    );
  });

  it('is in place when a later nested block sets something that can', async () => {
    expect(await run(`.a{height:calc(100dvh - var(--h));&:hover{block-size:1px}}`)).toBe(
      `.a{height:calc(100vh - var(--h));@supports (height: 1dvh){height:calc(100dvh - var(--h))}` +
        `&:hover{block-size:1px}}`
    );
  });

  it('is in place when a later nested block meets a repeated declaration', async () => {
    expect(
      await run(`.a{margin-top:var(--x,1dvh);margin:5px;&:hover{margin-left:0}}`)
    ).toBe(
      `.a{margin-top:var(--x,1vh);@supports (height: 1dvh){margin-top:var(--x,1dvh);margin:5px}` +
        `margin:5px;&:hover{margin-left:0}}`
    );
  });

  it('exists when an earlier nested block sets nothing that can meet it', async () => {
    const input = `.a{&:hover{color:blue}height:calc(100dvh - var(--h))}`;
    expect(await warningsOf(input)).toEqual([]);
    expect(await run(input)).toBe(
      `.a{&:hover{color:blue}height:calc(100vh - var(--h))}` +
        guard(`height:calc(100dvh - var(--h))`)
    );
  });

  it.each([
    ['the guarded value', `.a{&:hover{height:1px}height:calc(100dvh - var(--h))}`],
    [
      'a declaration repeated with it',
      `.a{&:hover{margin-left:0}margin-top:var(--x,1dvh);margin:5px}`,
    ],
  ])('cannot exist when an earlier nested block meets %s', async (_, input) => {
    expect(await warningsOf(input)).toHaveLength(1);
    expect(await run(input)).toBe(input);
  });
});

describe('a fallback written by hand', () => {
  it('is recognized across declarations that cannot meet it', async () => {
    const input = `.a{height:100vh;color:red;display:flex;height:100dvh}`;
    expect(await run(input)).toBe(input);
  });

  it('is not trusted across a declaration that can', async () => {
    expect(await run(`.a{margin:100vh;margin-top:0;margin:100dvh}`)).toBe(
      `.a{margin:100vh;margin-top:0;margin:100vh;margin:100dvh}`
    );
  });

  it('is not trusted across a property the table does not know', async () => {
    expect(await run(`.a{height:100vh;frobnicate:1;height:100dvh}`)).toBe(
      `.a{height:100vh;frobnicate:1;height:100vh;height:100dvh}`
    );
  });

  it('counts as any fallback across declarations that cannot meet it', async () => {
    const input = `.a{height:500px;color:red;height:100dvh}`;
    expect(await run(input, { existingFallback: 'any' })).toBe(input);
  });
});
