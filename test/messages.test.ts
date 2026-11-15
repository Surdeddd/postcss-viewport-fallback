import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import plugin from '../src';
import type { ViewportFallbackOptions } from '../src';
import { process as processCss, warningsOf } from './helpers/run';

const invalid = (options: unknown) => () => plugin(options as ViewportFallbackOptions);

describe('message language (PVF_LANG)', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.PVF_LANG;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.PVF_LANG;
    else process.env.PVF_LANG = saved;
  });

  it('speaks English by default', async () => {
    delete process.env.PVF_LANG;
    expect(invalid({ customUnits: { dvh: 'svh', svh: 'dvh' } })).toThrow(/mapping cycle/);
    await expect(processCss(`.a { height: 100dvh; }`, { strict: true })).rejects.toThrow(
      'Dynamic viewport unit found: height: 100dvh'
    );
    const [summary] = await warningsOf(`.a { height: 100dvh; }`, { debug: 'minimal' });
    expect(summary).toMatch(/1 declarations, 0 at-rules transformed/);
  });

  it('speaks Russian when PVF_LANG=ru', async () => {
    process.env.PVF_LANG = 'ru';
    expect(invalid({ customUnits: { dvh: 'svh', svh: 'dvh' } })).toThrow(/цикл/);
    expect(invalid({ strategy: 'cssvar' })).toThrow(/опци/);
    expect(invalid({ replace: true })).toThrow(
      /удалена в 2\.0: используйте preserve: false/
    );
    expect(invalid({ typo: true })).toThrow(/неизвестная опция "typo"/);
    await expect(processCss(`.a { height: 100dvh; }`, { strict: true })).rejects.toThrow(
      /Найдена динамическая viewport-единица: height: 100dvh/
    );
    const [summary] = await warningsOf(`.a { height: 100dvh; }`, { debug: 'minimal' });
    expect(summary).toMatch(/деклараций: 1/);
  });

  it('accepts regional and uppercase variants', () => {
    process.env.PVF_LANG = 'RU_ru.UTF-8';
    expect(invalid({ strategy: 'cssvar' })).toThrow(/опци/);
  });

  it('falls back to English for unsupported languages', () => {
    process.env.PVF_LANG = 'de';
    expect(invalid({ customUnits: { dvh: 'svh', svh: 'dvh' } })).toThrow(/mapping cycle/);
  });

  it('never mixes both languages in one message', () => {
    process.env.PVF_LANG = 'ru';
    let message = '';
    try {
      plugin({ strategy: 'cssvar' } as unknown as ViewportFallbackOptions);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toMatch(/invalid option|expected/);
  });
});
