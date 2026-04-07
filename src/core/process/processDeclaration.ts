import type { Declaration, Result } from 'postcss';
import { transformValue } from '../transform';
import { isVerbose } from '../debug';
import { hasSiblingDuplicate } from '../dedup';
import { DISABLE_COMMENT } from '../constants';
import type { ResolvedConfig } from '../config';
import type { TransformStats } from '../../plugin/types';

export function processDeclaration(
  decl: Declaration,
  config: ResolvedConfig,
  stats: TransformStats,
  result: Result,
) {
  // Control comment: skip if previous node is a disable comment
  const prev = decl.prev();
  if (prev?.type === 'comment' && prev.text.trim() === DISABLE_COMMENT) return;

  const original = decl.value;
  const prop = decl.prop;
  const quickTest = config.quickTest;

  if (isVerbose(config.debug)) {
    result.warn(`checking: ${prop} = ${original}`, { node: decl });
  }

  if (!quickTest.test(original)) return;

  if (config.strict) {
    throw decl.error(
      `[viewport-fallback] Dynamic viewport unit found: ${prop}: ${original}`,
      { word: original },
    );
  }

  if (prop.startsWith('--') && !config.includeCustomProps) return;

  const fallback = transformValue(original, prop, config);
  if (!fallback) return;

  if (isVerbose(config.debug)) {
    result.warn(`${prop}: ${original} → ${fallback}`, { node: decl });
  }

  // Dedup: skip if fallback declaration already exists
  const parent = decl.parent;
  if (parent) {
    const isDup = hasSiblingDuplicate(parent, decl, (node) =>
      node.type === 'decl' && node.prop === prop && node.value === fallback,
    );
    if (isDup) {
      stats.skipped++;
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
