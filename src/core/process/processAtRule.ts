import type { AtRule, Result } from 'postcss';
import { transformValue } from '../transform';
import { isVerbose } from '../debug';
import { hasSiblingDuplicate } from '../dedup';
import { isDisabledByComment } from '../controlComments';
import { unproxy } from '../proxy';
import type { ResolvedConfig } from '../config';
import type { RunContext } from '../context';

export function processAtRule(
  atRule: AtRule,
  ruleName: string,
  config: ResolvedConfig,
  ctx: RunContext,
  result: Result,
) {
  const params = atRule.params;
  if (!params || !config.quickTest.test(params)) return;

  if (ctx.generated.has(unproxy(atRule))) return;

  if (isDisabledByComment(atRule)) return;

  if (isVerbose(config.debug)) {
    result.warn(`checking: @${ruleName} ${params}`, { node: atRule });
  }

  // var() is invalid inside at-rule params, so at-rules always use the duplicate strategy
  const fallback = transformValue(params, `@${ruleName}`, config);
  if (!fallback || fallback === params) return;

  if (config.strict) {
    throw atRule.error(
      `[viewport-fallback] Dynamic viewport unit found: @${ruleName} ${params}`,
      { word: params },
    );
  }

  if (isVerbose(config.debug)) {
    result.warn(`@${ruleName}: ${params} → ${fallback}`, { node: atRule });
  }

  const parent = atRule.parent;
  if (parent) {
    const isDup = hasSiblingDuplicate(parent, (node) =>
      node.type === 'atrule' && node.name === ruleName && node.params === fallback,
    );
    if (isDup) {
      ctx.stats.skipped++;
      if (!config.shouldPreserve) atRule.remove();
      return;
    }
  }

  config.onTransform?.({
    prop: `@${ruleName}`,
    original: params,
    fallback,
    file: atRule.source?.input.file,
    selector: atRule.params,
    loc: atRule.source?.start,
  });

  atRule.cloneBefore({ params: fallback });
  ctx.stats.atRules++;

  if (!config.shouldPreserve) atRule.remove();
}
