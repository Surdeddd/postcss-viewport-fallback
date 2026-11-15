import { createRequire } from 'node:module';
import { join } from 'node:path';
import { t } from './messages';

export type BrowserslistQuery = true | string | string[];

interface SupportModules {
  browserslist: (query?: string | string[], options?: { path?: string }) => string[];
  caniuse: { isSupported: (feature: string, browsers: string[]) => boolean };
}

const FEATURE = 'viewport-unit-variants';

/** Load optional `caniuse-api` and its `browserslist` from the first base that has them. */
export function loadSupportModules(bases: readonly string[]): SupportModules | undefined {
  for (const base of bases) {
    try {
      const load = createRequire(base);
      const caniusePath = load.resolve('caniuse-api');
      return {
        caniuse: load(caniusePath) as SupportModules['caniuse'],
        browserslist: createRequire(caniusePath)(
          'browserslist'
        ) as SupportModules['browserslist'],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  return undefined;
}

/**
 * False when `caniuse-api` is unavailable; throws on an invalid query or config.
 * `true` reads the browserslist config that applies to `directory`.
 */
export function targetsSupportViewportUnits(
  query: BrowserslistQuery,
  bases: readonly string[] = [import.meta.url, join(process.cwd(), 'package.json')],
  directory: string = process.cwd()
): boolean {
  const modules = loadSupportModules(bases);
  if (!modules) return false;
  try {
    const targets =
      query === true
        ? modules.browserslist(undefined, { path: directory })
        : modules.browserslist(query);
    return modules.caniuse.isSupported(FEATURE, targets);
  } catch (error) {
    throw new Error(t('invalidBrowserslist', { reason: (error as Error).message }), {
      cause: error,
    });
  }
}
