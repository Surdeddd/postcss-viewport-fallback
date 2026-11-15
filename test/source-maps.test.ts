import { describe, it, expect } from 'vitest';
import type { ViewportFallbackOptions } from '../src';
import { process } from './helpers/run';

async function mapOf(css: string, opts: ViewportFallbackOptions) {
  const result = await process(css, opts, {
    from: '/project/src/app.css',
    to: '/project/dist/app.css',
    map: { inline: false, sourcesContent: false },
  });
  return { css: result.css, map: result.map.toJSON() };
}

describe('source maps', () => {
  it('maps declaration twins to the original file only', async () => {
    const { map } = await mapOf(`.a { height: 100dvh; }\n.b { width: 1dvw; }`, {});
    expect(map.sources).toEqual(['../src/app.css']);
  });

  it('does not introduce a phantom source for the css-var seed', async () => {
    const { css, map } = await mapOf(`@import "x.css";\n.a { height: 100dvh; }`, {
      strategy: 'css-var',
    });
    expect(css).toContain(':root, :host { --pvf-dvh: 1vh }');
    expect(map.sources).toEqual(['../src/app.css']);
  });

  it('does not introduce a phantom source for custom property guards', async () => {
    const { css, map } = await mapOf(`:root {\n  --h: 100dvh;\n}\n`, {
      includeCustomProps: true,
    });
    expect(css).toContain('@supports (height: 1dvh)');
    expect(map.sources).toEqual(['../src/app.css']);
  });

  it('does not introduce a phantom source for at-rule twins', async () => {
    const { map } = await mapOf(`@media (min-height: 50dvh) { .a { color: red; } }`, {});
    expect(map.sources).toEqual(['../src/app.css']);
  });
});

describe('line endings', () => {
  it('keeps CRLF in generated custom property guards', async () => {
    const result = await process(`:root {\r\n  --h: 100dvh;\r\n}\r\n`, {
      includeCustomProps: true,
    });
    expect(result.css).toBe(
      `:root {\r\n  --h: 100vh;\r\n}\r\n@supports (height: 1dvh) {\r\n  :root {\r\n    --h: 100dvh;\r\n  }\r\n}\r\n`
    );
  });

  it('keeps CRLF around the css-var seed', async () => {
    const result = await process(`@import "x.css";\r\n.a { height: 100dvh; }\r\n`, {
      strategy: 'css-var',
      preserve: false,
    });
    expect(result.css).toBe(
      `@import "x.css";\r\n:root, :host { --pvf-dvh: 1vh }\r\n@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }\r\n.a { height: calc(var(--pvf-dvh, 1vh) * 100); }\r\n`
    );
  });
});
