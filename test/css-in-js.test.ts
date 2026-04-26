import { describe, it, expect } from 'vitest';
import { processJsCss } from './helpers/cssInJsProcessor';
import plugin from '../src';

describe('viewport-fallback / CSS-in-JS template strings', () => {
  it('transforms values inside JS template literal', async () => {
    const input = [
      'const Box = styled.div(',
      '  `',
      '    height: 100dvh;',
      '    width: 50dvw;',
      '  `',
      ')',
    ].join('\n'); // <-- НИКАКИХ backtick внутри backtick

    const out = await processJsCss(input, plugin());

    expect(out.css).toContain('height: 100vh;');
    expect(out.css).toContain('height: 100dvh;');

    expect(out.css).toContain('width: 50vw;');
    expect(out.css).toContain('width: 50dvw;');
  });
});
