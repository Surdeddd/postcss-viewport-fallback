import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadSupportModules,
  targetsSupportViewportUnits,
} from '../../src/core/browserslist';

const nowhere = join(tmpdir(), 'pvf-no-such-project', 'package.json');

describe('optional caniuse-api loader', () => {
  it('returns undefined when caniuse-api cannot be resolved from any base', () => {
    expect(loadSupportModules([nowhere])).toBeUndefined();
  });

  it('falls through to the next base', () => {
    const modules = loadSupportModules([nowhere, import.meta.url]);
    expect(typeof modules?.caniuse.isSupported).toBe('function');
  });

  it('takes browserslist from the caniuse-api install', () => {
    const modules = loadSupportModules([import.meta.url]);
    expect(modules?.browserslist('chrome 130')).toEqual(['chrome 130']);
  });

  it('rethrows loader failures that are not "module not found"', () => {
    expect(() => loadSupportModules(['not-an-absolute-path.js'])).toThrow();
  });
});

describe('target support check', () => {
  it('reports "not supported" when caniuse-api is missing, so the plugin keeps working', () => {
    expect(targetsSupportViewportUnits('chrome >= 130', [nowhere])).toBe(false);
  });

  it('distinguishes modern and legacy targets', () => {
    expect(targetsSupportViewportUnits('chrome >= 130')).toBe(true);
    expect(targetsSupportViewportUnits(['chrome >= 130', 'ie 11'])).toBe(false);
  });

  it('keeps the original failure as the error cause', () => {
    let thrown: Error | undefined;
    try {
      targetsSupportViewportUnits('definitely !!! not a query');
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown?.message).toMatch(/invalid browserslist configuration/);
    expect(thrown?.cause).toBeInstanceOf(Error);
  });
});
