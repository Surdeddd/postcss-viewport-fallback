import { describe, it, expect } from 'vitest';
import { run } from './helpers/run';

describe('dimensions glued to operators', () => {
  it.each([
    ['min(100dvh*0.5, 400px)', 'min(100vh*0.5, 400px)'],
    ['max(2*50dvw, 10px)', 'max(2*50vw, 10px)'],
    ['clamp(10px, 100dvh*0.1, 3rem)', 'clamp(10px, 100vh*0.1, 3rem)'],
    ['calc((100dvh*2) - 10px)', 'calc((100vh*2) - 10px)'],
    ['CALC(100dvh*2)', 'CALC(100vh*2)'],
    ['-webkit-calc(100dvh*2)', '-webkit-calc(100vh*2)'],
    ['calc(100dvh*2)', 'calc(100vh*2)'],
    ['calc(100dvh/2)', 'calc(100vh/2)'],
  ])('transforms %s', async (value, fallback) => {
    const out = await run(`.a { height: ${value}; }`);
    expect(out).toBe(`.a { height: ${fallback}; height: ${value}; }`);
  });

  it('transforms every dimension inside one glued word', async () => {
    const out = await run(`.a { height: min(100dvh*50dvw, 1px); }`);
    expect(out).toContain('height: min(100vh*50vw, 1px);');
  });

  it('keeps the sign with its number in the css-var rewrite', async () => {
    const out = await run(`.a { top: max(-10dvh*2, 1px); }`, { strategy: 'css-var' });
    expect(out).toContain('top: max(calc(var(--pvf-dvh, 1vh) * -10)*2, 1px);');
  });
});

describe('range-syntax queries without whitespace', () => {
  it('transforms a media range comparison', async () => {
    const out = await run(`@media (height>=100dvh) { .a { color: red } }`);
    expect(out).toBe(`@media (height>=100vh),(height>=100dvh) { .a { color: red } }`);
  });

  it('transforms a container range comparison', async () => {
    const out = await run(`@container (width<100dvw) { .a { color: red } }`);
    expect(out).toContain('@container (width<100vw)');
    expect(out).toContain('@container (width<100dvw)');
  });

  it('transforms both ends of a double range', async () => {
    const out = await run(`@media (10dvh<=height<=90dvh) { .a { color: red } }`);
    expect(out).toContain('@media (10vh<=height<=90vh)');
  });

  it('transforms a colon feature without whitespace', async () => {
    const out = await run(`@media (min-height:100dvh){.a{color:red}}`);
    expect(out).toBe(`@media (min-height:100vh),(min-height:100dvh){.a{color:red}}`);
  });
});

describe('at-rule preludes without real dimensions', () => {
  it.each([
    `@container card1dvh (min-width: 10px) { .a { color: red; } }`,
    `@media (min-width: 10px) and (--x1dvh) { .a { color: red; } }`,
    `@media screen and (min-resolution: 2dppx) { .a { color: red; } }`,
  ])('leaves %s alone', async (input) => {
    expect(await run(input)).toBe(input);
  });
});

describe('non-dimension text is left alone', () => {
  it.each([
    'url(100dvh)',
    'URL(100dvh)',
    'url(./100dvh.png)',
    'url("100dvh")',
    'url( 100dvh )',
    '"100dvh"',
    "'height: 100dvh'",
    '100dvh-10px',
    'a-100dvh',
    'x100dvh',
    '#100dvh',
    '--scroll-100dvh-timeline',
    '100dvhx',
    '100dvh_2',
    'dvh',
    'var(--100dvh)',
  ])('does not touch %s', async (value) => {
    const input = `.a { background: ${value}; }`;
    expect(await run(input)).toBe(input);
  });

  it('transforms a dimension next to an untouched url()', async () => {
    const out = await run(`.a { background: url(100dvh.png) 0 10dvh; }`);
    expect(out).toContain('background: url(100dvh.png) 0 10vh;');
  });
});

describe('number forms', () => {
  it.each([
    ['.5dvh', '.5vh'],
    ['+.5dvh', '+.5vh'],
    ['-0.25dvh', '-0.25vh'],
    ['1e2dvh', '1e2vh'],
    ['1E2dvh', '1E2vh'],
    ['1.5e-2dvh', '1.5e-2vh'],
    ['1e+2dvh', '1e+2vh'],
    ['0dvh', '0vh'],
  ])('transforms %s', async (value, fallback) => {
    const out = await run(`.a { height: ${value}; }`);
    expect(out).toBe(`.a { height: ${fallback}; height: ${value}; }`);
  });

  it('builds the css-var product from the exact number text', async () => {
    const out = await run(`.a { height: 1.5e-2dvh; margin: +.5svw; }`, {
      strategy: 'css-var',
    });
    expect(out).toContain('height: calc(var(--pvf-dvh, 1vh) * 1.5e-2);');
    expect(out).toContain('margin: calc(var(--pvf-svw, 1vw) * +.5);');
  });
});

describe('source formatting', () => {
  it('keeps every byte outside the replaced units', async () => {
    const value = 'calc(  100dvh\t-  var( --gap , 2dvw )  )';
    const out = await run(`.a { height: ${value}; }`);
    expect(out).toContain('height: calc(  100vh\t-  var( --gap , 2vw )  );');
    expect(out).toContain(`height: ${value};`);
  });

  it('keeps the original casing of the number and surrounding functions', async () => {
    const out = await run(`.a { height: Calc(100DVH - 1PX); }`);
    expect(out).toContain('height: Calc(100vh - 1PX);');
  });
});
