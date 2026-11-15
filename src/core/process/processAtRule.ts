import type { AtRule, ChildNode } from 'postcss';
import type { ResolvedConfig } from '../config';
import type { RunContext } from '../context';
import { t } from '../messages';
import { transformValue } from '../parser';
import { unproxy } from '../proxy';
import { isGuardedBySupports } from '../supports';
import { announce, assertNotStrict, hackOf, terminalValue } from './shared';

/** What legacy browsers make of a subtree, ignoring comments and nodes this run generated. */
function legacyShape(node: ChildNode, config: ResolvedConfig, ctx: RunContext): string {
  if (node.type === 'comment' || ctx.generated.has(node)) return '';
  if (node.type === 'decl') {
    const value = terminalValue(node.value, config);
    return `${hackOf(node)}${node.prop}:${value}${node.important ? '!' : ''};`;
  }
  const head =
    node.type === 'rule'
      ? node.selector
      : `@${node.name} ${terminalValue(node.params, config)}`;
  const body = (node.nodes ?? [])
    .map((child) => legacyShape(child, config, ctx))
    .join('');
  return `${head}{${body}}`;
}

/** True when the closest earlier sibling, ignoring comments, already is this at-rule's twin. */
export function hasTwin(
  node: AtRule,
  name: string,
  fallback: string,
  config: ResolvedConfig,
  ctx: RunContext
): boolean {
  let candidate: ChildNode | undefined = node.prev();
  while (candidate?.type === 'comment') candidate = candidate.prev();
  return (
    candidate?.type === 'atrule' &&
    candidate.params === fallback &&
    candidate.name.toLowerCase() === name &&
    legacyShape(candidate, config, ctx) === legacyShape(node, config, ctx)
  );
}

const NAME = 'container';
const LABEL = `@${NAME}`;

/** Twin a `@container` rule whose prelude uses mapped units. */
export function processAtRule(
  atRule: AtRule,
  config: ResolvedConfig,
  ctx: RunContext
): void {
  const params = atRule.params;
  if (!config.quickTest.test(params)) return;

  const node = unproxy(atRule);
  const label = LABEL;
  if (!config.allows(label) || ctx.comments.isDisabled(node)) return;

  const revisited = ctx.handled.has(node);
  if (config.verbose && !revisited) {
    ctx.result.warn(t('checking', { subject: `${label} ${params}` }), { node });
  }

  const transformed = transformValue(params, config, 'duplicate');
  if (!transformed) return;
  if (isGuardedBySupports(node, transformed.units, config, ctx.supportsCache)) return;

  if (ctx.handled.get(node)?.parent) return;

  if (hasTwin(node, NAME, transformed.value, config, ctx)) {
    if (!revisited) ctx.stats.skipped++;
    ctx.handled.set(node, null);
  } else {
    assertNotStrict(config, node, `${label} ${params}`, params);
    announce(config, ctx, node, label, params, transformed.value);
    const clone = node.cloneBefore({ params: transformed.value });
    ctx.handled.set(node, clone);
    ctx.generated.add(clone);
    ctx.stats.atRules++;
  }

  if (!config.preserve) node.remove();
}
