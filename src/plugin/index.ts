import type { AtRule, Comment, Declaration, Document, Helpers, Plugin } from 'postcss';
import { resolveConfig } from '../core/config';
import { PLUGIN_NAME } from '../core/constants';
import { createRunContext, emptyStats } from '../core/context';
import { t } from '../core/messages';
import { processAtRule, processDeclaration, processQueryList } from '../core/process';
import { unproxy } from '../core/proxy';
import { injectSeeds } from '../core/seed';
import type { ViewportFallbackOptions } from './types';

const WALK_FREE = new Set(['postcssPlugin', 'postcssVersion', 'Once', 'OnceExit']);

/**
 * Whether a plugin of the pipeline may take part in the walk: its visitors would run between
 * ours. Read the way PostCSS reads a plugin: `prepare` wherever it is defined, and every
 * enumerable key, inherited ones included.
 */
function walksTheTree(other: object): boolean {
  if ((other as Partial<Plugin>).prepare) return true;
  for (const key in other) if (!WALK_FREE.has(key)) return true;
  return false;
}

export default function viewportFallback(options: ViewportFallbackOptions = {}): Plugin {
  const plugin = resolveConfig(options);

  const self: Plugin = {
    postcssPlugin: PLUGIN_NAME,

    prepare(result) {
      const config = plugin.forFile(result.opts.from ?? result.root?.source?.input.file);
      let finished = false;
      const once = (report: () => void) => (): void => {
        if (finished) return;
        finished = true;
        report();
      };
      /** PostCSS calls `OnceExit` per root: a document without one reports as it is left. */
      const rootless =
        (report: () => void) =>
        (document: Document): void => {
          if (document.nodes.length === 0) report();
        };

      const sourceText = result.root?.source?.input.css;
      const nothingToDo =
        !config.active ||
        (config.fastSkip &&
          typeof sourceText === 'string' &&
          !config.quickTest.test(sourceText));

      if (nothingToDo) {
        const report = once(() => config.onComplete?.(emptyStats()));
        return { OnceExit: report, DocumentExit: rootless(report) };
      }

      const alone = !result.processor.plugins.some(
        (other) => other !== self && typeof other === 'object' && walksTheTree(other)
      );
      const ctx = createRunContext(result);
      const startedAt = performance.now();
      let spent = 0;

      const walk = {
        Comment(comment: Comment) {
          ctx.comments.observe(unproxy(comment));
        },

        Declaration(decl: Declaration, helpers: Helpers) {
          processDeclaration(decl, config, ctx, helpers);
        },

        AtRule: {
          media(atRule: AtRule) {
            processQueryList(atRule, 'media', config, ctx);
          },
          import(atRule: AtRule) {
            processQueryList(atRule, 'import', config, ctx);
          },
          'custom-media'(atRule: AtRule) {
            processQueryList(atRule, 'custom-media', config, ctx);
          },
          container(atRule: AtRule) {
            processAtRule(atRule, config, ctx);
          },
        },
      };

      const seed = (): void => {
        if (config.seed && ctx.usedUnits.size > 0) {
          injectSeeds(result, ctx.usedUnits, config);
        }
      };

      const summarize = (elapsed: number): void => {
        const { stats } = ctx;
        stats.timeMs = Math.round(elapsed * 100) / 100;

        if (config.summary) {
          result.warn(
            t('summary', {
              declarations: stats.declarations,
              atRules: stats.atRules,
              skipped: stats.skipped ? t('summarySkipped', { count: stats.skipped }) : '',
              timeMs: stats.timeMs,
            })
          );
        }

        config.onComplete?.(stats);
      };

      if (alone) {
        const report = once(() => {
          seed();
          summarize(performance.now() - startedAt);
        });
        return { ...walk, OnceExit: report, DocumentExit: rootless(report) };
      }

      const report = once(() => summarize(spent));
      return {
        OnceExit(root, { postcss }) {
          const since = performance.now();
          postcss([{ postcssPlugin: PLUGIN_NAME, ...walk }])
            .process(root, { from: result.opts.from })
            .sync();
          spent += performance.now() - since;

          const top = result.root;
          if (top.type !== 'document' || root === top.last) {
            seed();
            report();
          }
        },
        DocumentExit: rootless(report),
      };
    },
  };
  return self;
}

viewportFallback.postcss = true as const;
