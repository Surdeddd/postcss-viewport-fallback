import type { Root, Declaration, AtRule, Helpers } from 'postcss';
import { DEFAULT_OPTIONS } from '../core/defaults';
import { mergeUnitMap } from '../core/units';
import { createUnitRegex, createQuickTest } from '../core/regex';
import type { ResolvedConfig } from '../core/config';
import type { ViewportFallbackOptions, TransformStats } from './types';

import {
  processContainer,
  processDeclaration,
  processMedia,
  processSupports,
} from '../core/process';

let browserslistResult: boolean | null = null;

function checkBrowserslistSupport(): boolean {
  if (browserslistResult !== null) return browserslistResult;
  browserslistResult = false;
  try {
    const loadModule = new Function('m', 'return require(m)') as (m: string) => unknown;
    const caniuse = loadModule('caniuse-api') as {
      isSupported: (feat: string, browsers: string[]) => boolean;
      getBrowserScope: () => string[];
    };
    browserslistResult = caniuse.isSupported(
      'viewport-unit-variants',
      caniuse.getBrowserScope(),
    );
  } catch {
    // caniuse-api not installed — skip
  }
  return browserslistResult;
}

export default function viewportFallback(options: ViewportFallbackOptions = {}) {
  const opts: ViewportFallbackOptions = { ...DEFAULT_OPTIONS, ...options };

  // Browserslist: auto-skip if all targets support dvh/svh/lvh
  if (opts.browserslist && checkBrowserslistSupport()) {
    return {
      postcssPlugin: 'postcss-viewport-fallback',
      Once() {
        // no-op: all targets support dynamic viewport units
      },
    };
  }

  // Resolve unit map and regex once at init
  const unitMap = mergeUnitMap(opts.customUnits);
  const unitKeys = Object.keys(unitMap);

  // Resolve preserve: `replace` is deprecated alias for `preserve: false`
  // User-provided `preserve` takes priority; fallback to inverse of `replace`
  const shouldPreserve = options.preserve !== undefined
    ? options.preserve
    : options.replace !== undefined
      ? !options.replace
      : true;

  const config: ResolvedConfig = {
    ...opts,
    unitMap,
    unitRegex: createUnitRegex(unitKeys),
    quickTest: createQuickTest(unitKeys),
    shouldPreserve,
  };

  let stats: TransformStats;
  let startTime: number;

  return {
    postcssPlugin: 'postcss-viewport-fallback',

    Once() {
      startTime = performance.now();
      stats = { declarations: 0, atRules: 0, skipped: 0, timeMs: 0 };
    },

    Declaration(decl: Declaration, { result }: Helpers) {
      processDeclaration(decl, config, stats, result);
    },

    AtRule: {
      media(atRule: AtRule, { result }: Helpers) {
        processMedia(atRule, config, stats, result);
      },
      supports(atRule: AtRule, { result }: Helpers) {
        processSupports(atRule, config, stats, result);
      },
      container(atRule: AtRule, { result }: Helpers) {
        processContainer(atRule, config, stats, result);
      },
    },

    OnceExit(_root: Root, { result }: Helpers) {
      stats.timeMs = Math.round((performance.now() - startTime) * 100) / 100;

      if (config.debug) {
        const summary =
          `[viewport-fallback] ${stats.declarations} declarations, ${stats.atRules} at-rules transformed` +
          (stats.skipped ? `, ${stats.skipped} skipped (dedup)` : '') +
          ` (${stats.timeMs}ms)`;
        result.warn(summary);
      }

      config.onComplete?.(stats);
    },
  };
}

viewportFallback.postcss = true;
