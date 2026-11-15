import type { AtRule } from 'postcss';
import type { ResolvedConfig } from '../config';
import type { RunContext } from '../context';
import { t } from '../messages';
import { transformValue } from '../parser';
import { unproxy } from '../proxy';
import { lowerQueryList, queryListStart } from '../queryList';
import type { QueryListOwner } from '../queryList';
import { isGuardedBySupports } from '../supports';
import { hasTwin } from './processAtRule';
import { announce, assertNotStrict } from './shared';

/** Add lowered alternatives to the media queries of `@media`, `@import` and `@custom-media`. */
export function processQueryList(
  atRule: AtRule,
  owner: QueryListOwner,
  config: ResolvedConfig,
  ctx: RunContext
): void {
  const params = atRule.params;
  if (!config.quickTest.test(params)) return;

  const node = unproxy(atRule);
  const label = `@${owner}`;
  if (!config.allows(label) || ctx.comments.isDisabled(node)) return;

  const start = queryListStart(owner, params);
  const list = start === -1 ? '' : params.slice(start);
  const lowered = transformValue(list, config, 'duplicate');
  if (!lowered) return;
  if (isGuardedBySupports(node, lowered.units, config, ctx.supportsCache)) return;

  const revisited = ctx.handled.has(node);
  if (config.verbose && !revisited) {
    ctx.result.warn(t('checking', { subject: `${label} ${params}` }), { node });
  }
  ctx.handled.set(node, null);

  const written = node.raws.params;
  const text = written?.value === params ? written.raw : params;
  const from = queryListStart(owner, text);
  const twinned = owner === 'media' && hasTwin(node, owner, lowered.value, config, ctx);
  const change = twinned
    ? null
    : lowerQueryList(text.slice(from), config, config.preserve);
  if (!change) {
    if (!revisited) ctx.stats.skipped++;
    if (twinned && !config.preserve) node.remove();
    return;
  }

  assertNotStrict(config, node, `${label} ${params}`, params);
  if (!revisited) {
    announce(config, ctx, node, label, change.original, change.fallback);
    ctx.stats.atRules++;
  }
  atRule.params = text.slice(0, from) + change.value;
}
