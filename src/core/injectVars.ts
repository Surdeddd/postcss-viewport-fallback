import type { Document, Node, Root } from 'postcss';
import { CSS_VAR_PREFIX, RANGE_DISABLE, RANGE_ENABLE } from './constants';

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
  usedUnits: Map<string, string>,
  generated: WeakSet<Node>,
): void {
  const target = root.type === 'document' ? root.first : root;
  if (!target || target.type !== 'root') return;
  if (hasSeed(target)) return;

  const entries = [...usedUnits.entries()].sort(([a], [b]) => a.localeCompare(b));
  const base = entries.map(([u, f]) => `${CSS_VAR_PREFIX}${u}: 1${f}`).join('; ');
  const upgrades = entries
    .map(([u]) => `@supports (height: 1${u}) { :root { ${CSS_VAR_PREFIX}${u}: 1${u} } }`)
    .join('\n');

  const seed =
    `/* ${RANGE_DISABLE} */\n` +
    `:root { ${base} }\n${upgrades}\n` +
    `/* ${RANGE_ENABLE} */`;

  target.prepend(seed);

  const seedNodeCount = 3 + entries.length;
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
