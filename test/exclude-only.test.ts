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
      ');',
    ].join('\n');

    const res = await processJsCss(
      input,
      plugin({
        // 👈 главное: используем правильную опцию из типов
        excludeProperties: ['width'],
      })
    );

    // height должен трансформироваться
    expect(res.css).toContain('height: 100vh;');
    expect(res.css).toContain('height: 100dvh;');

    // width должен остаться только с dvw, без обычного vw-фоллбэка
    expect(res.css).toContain('width: 50dvw;');
    expect(res.css).not.toContain('width: 50vw;');
  });
});
