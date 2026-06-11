import type { ChildNode, Container } from 'postcss';

/** Check if any sibling matching the predicate already exists in the container. */
export function hasSiblingDuplicate(
  parent: Container,
  matchFn: (node: ChildNode) => boolean,
): boolean {
  let found = false;
  parent.each((node) => {
    if (matchFn(node)) {
      found = true;
      return false;
    }
  });
  return found;
}
