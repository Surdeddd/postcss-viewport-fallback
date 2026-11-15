import type { Declaration, Helpers } from 'postcss';
import type { ResolvedConfig } from '../config';
import { CSS_VAR_PREFIX } from '../constants';
import { markUnitsUsed } from '../context';
import type { RunContext } from '../context';
import { isCustomProperty } from '../escape';
import { t } from '../messages';
import { hasSubstitution, transformValue } from '../parser';
import type { FallbackStrategy } from '../parser';
import { unproxy } from '../proxy';
import { isGuardedBySupports } from '../supports';
import { isRegisteredInitial, processDeferred } from './processDeferred';
import { announce, assertNotStrict, fallbackInEffect } from './shared';

const DESCRIPTOR_AT_RULES = new Set([
  'property',
  'font-face',
  'counter-style',
  'font-palette-values',
  'color-profile',
  'view-transition',
  'page',
]);

function strategyFor(node: Declaration, config: ResolvedConfig): FallbackStrategy {
  if (config.strategy === 'duplicate') return 'duplicate';
  const parent = node.parent;
  const isDescriptor =
    parent?.type === 'atrule' && DESCRIPTOR_AT_RULES.has(parent.name.toLowerCase());
  return isDescriptor ? 'duplicate' : 'css-var';
}

/** Give a declaration that uses mapped units a fallback that legacy browsers can apply. */
export function processDeclaration(
  decl: Declaration,
  config: ResolvedConfig,
  ctx: RunContext,
  helpers: Helpers
): void {
  if (!config.quickTest.test(decl.value)) return;

  const node = unproxy(decl);
  if (ctx.waiting.has(node)) return;

  const value = node.value;
  const prop = node.prop;
  const isCustom = isCustomProperty(prop);
  const ours =
    !(isCustom && (!config.includeCustomProps || prop.startsWith(CSS_VAR_PREFIX))) &&
    config.allows(prop) &&
    !ctx.comments.isDisabled(node);

  const revisited = ctx.handled.has(node);
  if (ours && config.verbose && !revisited) {
    ctx.result.warn(t('checking', { subject: `${prop} = ${value}` }), { node });
  }

  const strategy = strategyFor(node, config);
  const transformed = ours ? transformValue(value, config, strategy) : null;
  if (
    !transformed ||
    isGuardedBySupports(node, transformed.units, config, ctx.supportsCache)
  ) {
    return;
  }

  if (isCustom || hasSubstitution(value) || isRegisteredInitial(node)) {
    processDeferred(decl, transformed, strategy, isCustom, config, ctx, helpers);
    return;
  }

  if (ctx.handled.get(node)?.parent) return;
  if (strategy === 'css-var') markUnitsUsed(ctx, node, transformed.units);

  if (fallbackInEffect(node, transformed.value, config, ctx)) {
    ctx.stats.skipped++;
    ctx.handled.set(node, null);
  } else {
    assertNotStrict(config, node, `${prop}: ${value}`, value);
    announce(config, ctx, node, prop, value, transformed.value);
    const clone = node.cloneBefore({ value: transformed.value });
    ctx.handled.set(node, clone);
    ctx.generated.add(clone);
    ctx.stats.declarations++;
  }

  if (!config.preserve) node.remove();
}
