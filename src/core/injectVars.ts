import type { Document, Node, Root } from 'postcss';
import { CSS_VAR_PREFIX, RANGE_DISABLE, RANGE_ENABLE } from './constants';
import { resolveFallbackChain } from './units';

function hasSeed(target: Root): boolean {
  let found = false;
  target.each((node) => {
    if (
      node.type === 'rule' &&
      node.selector === ':root' &&
      node.first?.type === 'decl' &&
      node.first.prop.startsWith(CSS_VAR_PREFIX)
    ) {
      found = true;
      return false;
    }
  });
  return found;
}

export function injectViewportVars(
  root: Root | Document,
  usedUnits: Set<string>,
  unitMap: Record<string, string>,
  generated: WeakSet<Node>,
): void {
  const target = root.type === 'document' ? root.first : root;
  if (!target || target.type !== 'root') return;
  if (hasSeed(target)) return;

  const units = [...usedUnits].sort();
  const chains = units.map((unit) => ({ unit, chain: resolveFallbackChain(unit, unitMap) }));

  const base = chains
    .map(({ unit, chain }) => `${CSS_VAR_PREFIX}${unit}: 1${chain[0]}`)
    .join('; ');
  const upgrades = chains.flatMap(({ unit, chain }) =>
    chain
      .slice(1)
      .map(
        (step) =>
          `@supports (height: 1${step}) { :root { ${CSS_VAR_PREFIX}${unit}: 1${step} } }`,
      ),
  );

  const seed =
    `/* ${RANGE_DISABLE} */\n` +
    `:root { ${base} }\n${upgrades.join('\n')}\n` +
    `/* ${RANGE_ENABLE} */`;

  target.prepend(seed);

  const seedNodeCount = 3 + upgrades.length;
  let i = 0;
  target.each((node) => {
    if (i++ >= seedNodeCount) return false;
    generated.add(node);
    if ('walk' in node && typeof node.walk === 'function') {
      node.walk((child) => {
        generated.add(child);
      });
    }
  });
}
