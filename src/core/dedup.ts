import type { ChildNode, Container } from 'postcss';

/**
 * Check if a sibling node matching the given predicate exists before the current node.
 */
export function hasSiblingDuplicate(
  parent: Container,
  currentNode: ChildNode,
  matchFn: (node: ChildNode) => boolean,
): boolean {
  let found = false;
  parent.each((node) => {
    if (node === currentNode) return false; // stop at current node
    if (matchFn(node)) {
      found = true;
      return false;
    }
  });
  return found;
}
