import type { AnyNode, ChildNode, Declaration } from 'postcss';
import type { ResolvedConfig } from '../config';
import type { RunContext } from '../context';
import { isCustomProperty, sameProperty } from '../escape';
import { t } from '../messages';
import { transformValue } from '../parser';
import { createFootprint } from '../properties';
import type { Footprint } from '../properties';

function enclosingSelector(node: ChildNode): string | undefined {
  let parent = node.parent as AnyNode | undefined;
  for (; parent; parent = parent.parent as AnyNode | undefined) {
    if (parent.type === 'rule') return parent.selector;
  }
  return undefined;
}

/** Tell the user about a fallback: the debug log and `onTransform`. */
export function announce(
  config: ResolvedConfig,
  ctx: RunContext,
  node: ChildNode,
  prop: string,
  original: string,
  fallback: string
): void {
  if (config.verbose) ctx.result.warn(`${prop}: ${original} → ${fallback}`, { node });
  config.onTransform?.({
    prop,
    original,
    fallback,
    file: node.source?.input.file,
    selector: enclosingSelector(node),
    loc: node.source?.start,
  });
}

/** Strict mode stops here: a fallback is about to be added, or cannot be. */
export function assertNotStrict(
  config: ResolvedConfig,
  node: ChildNode,
  subject: string,
  word: string
): void {
  if (config.strict) throw node.error(t('strict', { subject }), { word });
}

/** A value with every mapped unit at the end of its chain. */
export function terminalValue(value: string, config: ResolvedConfig): string {
  for (let next; (next = transformValue(value, config, 'duplicate'));) value = next.value;
  return value;
}

const HACK = /[*_]$/;

/** The `*` or `_` of an old IE hack; PostCSS keeps it in front of the property, not in its name. */
export function hackOf(decl: Declaration): string {
  return HACK.exec(decl.raws.before ?? '')?.[0] ?? '';
}

/** True when the fallback already holds this declaration's cascade place or a later one wins. */
export function fallbackInEffect(
  node: Declaration,
  fallback: string,
  config: ResolvedConfig,
  ctx: RunContext
): boolean {
  const siblings = node.parent!.nodes;
  const index = siblings.indexOf(node);
  const hack = hackOf(node);
  const isRival = (sibling: ChildNode): sibling is Declaration =>
    sibling.type === 'decl' &&
    !sibling.important === !node.important &&
    hackOf(sibling) === hack &&
    sameProperty(sibling.prop, node.prop);
  const carriesFallback = (sibling: ChildNode): boolean =>
    isRival(sibling) && sibling.value === fallback;
  const standsIn = (sibling: Declaration): boolean =>
    config.anyFallback && isRival(sibling) && !config.quickTest.test(sibling.value);

  if (siblings.slice(index + 1).some(carriesFallback)) return true;

  let onlyRepeats = true;
  let onlyAuthored = true;
  let footprint: Footprint | undefined;
  for (let i = index - 1; i >= 0; i--) {
    const sibling = siblings[i];
    if (sibling.type === 'comment') continue;
    if (sibling.type !== 'decl') return false;
    if (isCustomProperty(sibling.prop) || hackOf(sibling) !== hack) continue;
    if (!sameProperty(sibling.prop, node.prop)) {
      if (!footprint) (footprint = createFootprint()).add(node.prop);
      if (footprint.touches(sibling.prop)) return false;
      continue;
    }

    const authored = !ctx.generated.has(sibling);
    if (carriesFallback(sibling)) return onlyRepeats || (onlyAuthored && authored);
    if (authored && standsIn(sibling)) return onlyAuthored;
    onlyRepeats &&= sibling.value === node.value;
    onlyAuthored &&= authored;
  }
  return false;
}
