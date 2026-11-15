import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { writtenLines } from '../playground/diff';
import {
  DEFAULTS,
  configSnippet,
  decodeState,
  encodeState,
  parseUnits,
  pluginOptions,
} from '../playground/state';
import { run } from './helpers/run';

describe('playground settings', () => {
  it('pass nothing to the plugin while they are the defaults', () => {
    expect(pluginOptions(DEFAULTS)).toEqual({});
  });

  it('pass on what differs from the defaults', () => {
    expect(
      pluginOptions({
        ...DEFAULTS,
        strategy: 'css-var',
        preserve: false,
        includeCustomProps: true,
        fragmentGuards: true,
        seed: false,
        existingFallback: 'any',
        logicalFallback: 'logical',
        customUnits: 'cqh: svh',
      })
    ).toEqual({
      strategy: 'css-var',
      preserve: false,
      includeCustomProps: true,
      fragmentGuards: true,
      seed: false,
      existingFallback: 'any',
      logicalFallback: 'logical',
      customUnits: { cqh: 'svh' },
    });
  });

  it.each([
    ['', undefined],
    ['  ', undefined],
    ['cqh: svh', { cqh: 'svh' }],
    ['cqh:svh, cqw : svw', { cqh: 'svh', cqw: 'svw' }],
    ['cqh: svh\ncqw: %;', { cqh: 'svh', cqw: '%' }],
    ['cqh', { cqh: '' }],
  ])('read the custom units field %j', (text, units) => {
    expect(parseUnits(text)).toEqual(units);
  });

  it('are plugin options the plugin accepts', async () => {
    const options = pluginOptions({ ...DEFAULTS, customUnits: 'cqh: svh' });
    expect(await run(`.a{height:1cqh}`, options)).toBe(
      `.a{height:1vh;height:1svh;height:1cqh}`
    );
  });
});

describe('the config the playground offers to copy', () => {
  it('calls the plugin without options for the defaults', () => {
    expect(configSnippet(DEFAULTS)).toBe(
      `import viewportFallback from 'postcss-viewport-fallback';\n\n` +
        `export default {\n  plugins: [viewportFallback()],\n};\n`
    );
  });

  it('lists the options that are set', () => {
    expect(
      configSnippet({
        ...DEFAULTS,
        strategy: 'css-var',
        preserve: false,
        customUnits: 'cqh: svh, cqw: svw',
      })
    ).toBe(
      `import viewportFallback from 'postcss-viewport-fallback';\n\n` +
        `export default {\n  plugins: [\n    viewportFallback({\n` +
        `      strategy: 'css-var',\n      preserve: false,\n` +
        `      customUnits: { cqh: 'svh', cqw: 'svw' },\n` +
        `    }),\n  ],\n};\n`
    );
  });
});

describe('the state in a shared link', () => {
  it('comes back as it was written', () => {
    const state = {
      css: `.a { height: 100dvh; /* высота ✓ */ }\n`,
      settings: { ...DEFAULTS, strategy: 'css-var' as const, customUnits: 'cqh: svh' },
    };
    const hash = encodeState(state);
    expect(hash).toMatch(/^[\w-]+$/);
    expect(decodeState(`#${hash}`)).toEqual(state);
    expect(decodeState(hash)).toEqual(state);
  });

  it('survives a long stylesheet', () => {
    const css = `.a{height:100dvh}\n`.repeat(5000);
    expect(decodeState(encodeState({ css, settings: DEFAULTS }))?.css).toBe(css);
  });

  it.each(['', '#', '#not-a-state', '#e30', `#${btoa('[1]')}`, `#${btoa('{"c":1}')}`])(
    'is nothing when the fragment is %j',
    (hash) => {
      expect(decodeState(hash)).toBeUndefined();
    }
  );

  it('keeps the defaults for settings it does not know', () => {
    const hash = btoa(
      JSON.stringify({ c: 'a{}', s: { strategy: 'nope', preserve: 'yes', seed: false } })
    );
    expect(decodeState(hash)).toEqual({
      css: 'a{}',
      settings: { ...DEFAULTS, seed: false },
    });
  });
});

describe('the lines of the output that the plugin wrote', () => {
  const marks = async (input: string, options = {}): Promise<string[]> => {
    const output = await run(input, options);
    const written = writtenLines(postcss.parse(input), postcss.parse(output));
    return output
      .split('\n')
      .map((line, i) => `${written.has(i + 1) ? '+' : ' '} ${line}`);
  };

  it('are none when nothing changed', async () => {
    expect(await marks(`.a {\n  color: red;\n}`)).toEqual([
      '  .a {',
      '    color: red;',
      '  }',
    ]);
  });

  it('are the twin of a declaration', async () => {
    expect(await marks(`.a {\n  height: 100dvh;\n  color: red;\n}`)).toEqual([
      '  .a {',
      '+   height: 100vh;',
      '    height: 100dvh;',
      '    color: red;',
      '  }',
    ]);
  });

  it('are the fallback in the rule and the whole block after it', async () => {
    expect(
      await marks(`.a {\n  height: calc(100dvh - var(--h));\n}\n.b {\n  color: red;\n}`)
    ).toEqual([
      '  .a {',
      '+   height: calc(100vh - var(--h));',
      '  }',
      '+ @supports (height: 1dvh) {',
      '+   .a {',
      '+     height: calc(100dvh - var(--h));',
      '+   }',
      '+ }',
      '  .b {',
      '    color: red;',
      '  }',
    ]);
  });

  it('are only the prelude of an at-rule whose list of queries grew', async () => {
    expect(
      await marks(`@media (min-height: 100dvh) {\n  .a {\n    color: red;\n  }\n}`)
    ).toEqual([
      '+ @media (min-height: 100vh), (min-height: 100dvh) {',
      '    .a {',
      '      color: red;',
      '    }',
      '  }',
    ]);
  });

  it('are the twin of a container rule, not the rule the author wrote', async () => {
    expect(
      await marks(`@container (width > 50dvw) {\n  .a {\n    color: red;\n  }\n}`)
    ).toEqual([
      '+ @container (width > 50vw) {',
      '+   .a {',
      '+     color: red;',
      '+   }',
      '+ }',
      '  @container (width > 50dvw) {',
      '    .a {',
      '      color: red;',
      '    }',
      '  }',
    ]);
  });

  it('are the seed and the rewritten value of the css-var strategy', async () => {
    expect(await marks(`.a {\n  height: 100dvh;\n}`, { strategy: 'css-var' })).toEqual([
      '+ :root, :host { --pvf-dvh: 1vh }',
      '+ @supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }',
      '  .a {',
      '+   height: calc(var(--pvf-dvh, 1vh) * 100);',
      '    height: 100dvh;',
      '  }',
    ]);
  });

  it('are not a block of the author with the same condition as a block of the plugin', async () => {
    expect(
      await marks(`.a{height:var(--x,1dvh)}\n@supports (height: 1dvh){.b{color:red}}`)
    ).toEqual([
      '+ .a{height:var(--x,1vh)}',
      '+ @supports (height: 1dvh){.a{height:var(--x,1dvh)}}',
      '  @supports (height: 1dvh){.b{color:red}}',
    ]);
  });

  it('are not the frame of an authored block that follows a block of the plugin', async () => {
    expect(
      await marks(
        `.a {\n  height: var(--x, 1dvh);\n}\n@supports (display: grid) {\n  .b {\n    height: 100dvh;\n  }\n}`
      )
    ).toEqual([
      '  .a {',
      '+   height: var(--x, 1vh);',
      '  }',
      '+ @supports (height: 1dvh) {',
      '+   .a {',
      '+     height: var(--x, 1dvh);',
      '+   }',
      '+ }',
      '  @supports (display: grid) {',
      '    .b {',
      '+     height: 100vh;',
      '      height: 100dvh;',
      '    }',
      '  }',
    ]);
  });

  it('are found among repeated declarations, the earliest counterpart first', async () => {
    expect(await marks(`.a {\n  top: 0;\n  top: 1dvh;\n  top: 0;\n}`)).toEqual([
      '  .a {',
      '    top: 0;',
      '+   top: 1vh;',
      '    top: 1dvh;',
      '    top: 0;',
      '  }',
    ]);
  });
});
