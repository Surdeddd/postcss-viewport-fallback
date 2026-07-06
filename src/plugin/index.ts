import { createRequire } from 'node:module';
import type { Declaration, AtRule, Plugin, Result, Root, Document } from 'postcss';
import { DEFAULT_OPTIONS } from '../core/defaults';
import { assertNoUnitCycles, mergeUnitMap } from '../core/units';
import { createUnitRegex, createQuickTest } from '../core/regex';
import { injectViewportVars } from '../core/injectVars';
import type { ResolvedConfig } from '../core/config';
import type { RunContext } from '../core/context';
import type {
  ViewportFallbackOptions,
  TransformStats,
  PropertyFilter,
  PropertyFilterInput,
} from './types';

import { processAtRule, processDeclaration } from '../core/process';

function checkBrowserslistSupport(query: true | string | string[]): boolean {
  try {
    const req = createRequire(import.meta.url);
    const browserslist = req('browserslist') as (query?: string | string[]) => string[];
    const caniuse = req('caniuse-api') as {
      isSupported: (feat: string, browsers: string | string[]) => boolean;
    };
    const targets = query === true ? browserslist() : browserslist(query);
    return caniuse.isSupported('viewport-unit-variants', targets);
  } catch {
    return false;
  }
}

function normalizeFilter(filter: PropertyFilterInput | undefined): PropertyFilter | undefined {
  if (filter === undefined) return undefined;
  return Array.isArray(filter) ? filter : [filter];
}

export default function viewportFallback(options: ViewportFallbackOptions = {}): Plugin {
  const opts: ViewportFallbackOptions = { ...DEFAULT_OPTIONS, ...options };

  if (opts.browserslist && checkBrowserslistSupport(opts.browserslist)) {
    return {
      postcssPlugin: 'postcss-viewport-fallback',
      OnceExit() {
        opts.onComplete?.({ declarations: 0, atRules: 0, skipped: 0, timeMs: 0 });
      },
    };
  }

  const unitMap = mergeUnitMap(opts.customUnits);
  assertNoUnitCycles(unitMap);
  const unitKeys = Object.keys(unitMap);

  const shouldPreserve = options.preserve !== undefined
    ? options.preserve
    : options.replace !== undefined
      ? !options.replace
      : true;

  const strategy = opts.strategy ?? 'duplicate';

  const config: ResolvedConfig = {
    ...opts,
    strategy,
    excludeProperties: normalizeFilter(opts.excludeProperties),
    onlyProperties: normalizeFilter(opts.onlyProperties),
    unitMap,
    unitRegex: createUnitRegex(unitKeys),
    quickTest: createQuickTest(unitKeys),
    shouldPreserve,
  };

  return {
    postcssPlugin: 'postcss-viewport-fallback',

    prepare(result: Result) {
      if (config.fastSkip) {
        const css = result.root?.source?.input?.css;
        if (typeof css === 'string' && !config.quickTest.test(css)) {
          return {
            OnceExit() {
              config.onComplete?.({ declarations: 0, atRules: 0, skipped: 0, timeMs: 0 });
            },
          };
        }
      }

      const startTime = performance.now();
      const stats: TransformStats = { declarations: 0, atRules: 0, skipped: 0, timeMs: 0 };
      const usedUnits = new Map<string, string>();
      const ctx: RunContext = {
        stats,
        usedUnits,
        generated: new WeakSet(),
        transformCtx: {
          strategy,
          onUnitUsed:
            strategy === 'css-var'
              ? (unit, fallbackUnit) => usedUnits.set(unit, fallbackUnit)
              : undefined,
        },
      };

      return {
        Declaration(decl: Declaration) {
          processDeclaration(decl, config, ctx, result);
        },

        AtRule: {
          media(atRule: AtRule) {
            processAtRule(atRule, 'media', config, ctx, result);
          },
          supports(atRule: AtRule) {
            processAtRule(atRule, 'supports', config, ctx, result);
          },
          container(atRule: AtRule) {
            processAtRule(atRule, 'container', config, ctx, result);
          },
        },

        OnceExit(root: Root | Document) {
          if (strategy === 'css-var' && usedUnits.size > 0) {
            injectViewportVars(root, usedUnits, ctx.generated);
          }

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
    },
  };
}

viewportFallback.postcss = true;
