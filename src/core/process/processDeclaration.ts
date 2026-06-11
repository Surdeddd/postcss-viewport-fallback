import type { Declaration, Result } from 'postcss';
import { transformValue } from '../transform';
import { isVerbose } from '../debug';
import { hasSiblingDuplicate } from '../dedup';
import { isDisabledByComment } from '../controlComments';
import type { ResolvedConfig } from '../config';
import type { TransformStats } from '../../plugin/types';

export function processDeclaration(
  decl: Declaration,
  config: ResolvedConfig,
  stats: TransformStats,
  result: Result,
) {
  const original = decl.value;
  const prop = decl.prop;

  if (isVerbose(config.debug)) {
    result.warn(`checking: ${prop} = ${original}`, { node: decl });
  }

  if (!config.quickTest.test(original)) return;

  if (isDisabledByComment(decl)) return;

  if (prop.startsWith('--') && !config.includeCustomProps) return;

  const fallback = transformValue(original, prop, config);
  if (!fallback || fallback === original) return;

  if (config.strict) {
    throw decl.error(
      `[viewport-fallback] Dynamic viewport unit found: ${prop}: ${original}`,
      { word: original },
    );
  }

  if (isVerbose(config.debug)) {
    result.warn(`${prop}: ${original} → ${fallback}`, { node: decl });
  }

  const parent = decl.parent;
  if (parent) {
    const isDup = hasSiblingDuplicate(parent, (node) =>
      node.type === 'decl' && node.prop === prop && node.value === fallback,
    );
    if (isDup) {
      stats.skipped++;
      if (!config.shouldPreserve) decl.remove();
      return;
    }
  }

  config.onTransform?.({
    prop,
    original,
    fallback,
    file: decl.source?.input.file,
    selector: decl.parent?.type === 'rule' ? decl.parent.selector : decl.parent?.toString(),
    loc: decl.source?.start,
  });

  decl.cloneBefore({ value: fallback });
  stats.declarations++;

  if (!config.shouldPreserve) decl.remove();
}
