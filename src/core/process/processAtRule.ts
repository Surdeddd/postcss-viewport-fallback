import type { AtRule, Result } from 'postcss';
import { transformValue } from '../transform';
import { isVerbose } from '../debug';
import { hasSiblingDuplicate } from '../dedup';
import { DISABLE_COMMENT } from '../constants';
import type { ResolvedConfig } from '../config';
import type { TransformStats } from '../../plugin/types';

export function processAtRule(
  atRule: AtRule,
  ruleName: string,
  config: ResolvedConfig,
  stats: TransformStats,
  result: Result,
) {
  // Control comment: skip if previous node is a disable comment
  const prev = atRule.prev();
  if (prev?.type === 'comment' && prev.text.trim() === DISABLE_COMMENT) return;

  const params = atRule.params;
  if (!params || !config.quickTest.test(params)) return;

  if (isVerbose(config.debug)) {
    result.warn(`checking: @${ruleName} ${params}`, { node: atRule });
  }

  const fallback = transformValue(params, `@${ruleName}`, config);
  if (!fallback || fallback === params) return;

  if (isVerbose(config.debug)) {
    result.warn(`@${ruleName}: ${params} → ${fallback}`, { node: atRule });
  }

  const parent = atRule.parent;
  if (parent) {
    const isDup = hasSiblingDuplicate(parent, atRule, (node) =>
      node.type === 'atrule' && node.name === ruleName && node.params === fallback,
    );
    if (isDup) {
      stats.skipped++;
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
  stats.atRules++;
}
