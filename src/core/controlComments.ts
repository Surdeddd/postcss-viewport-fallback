import type { ChildNode, Container, Document, Root } from 'postcss';
import { DISABLE_COMMENT, RANGE_DISABLE, RANGE_ENABLE } from './constants';

const rangeCommentCache = new WeakMap<Root | Document, boolean>();

function hasRangeComments(node: ChildNode): boolean {
  const root = node.root();
  let cached = rangeCommentCache.get(root);
  if (cached === undefined) {
    cached = false;
    root.walkComments((comment) => {
      const text = comment.text.trim();
      if (text === RANGE_DISABLE || text === RANGE_ENABLE) {
        cached = true;
        return false;
      }
    });
    rangeCommentCache.set(root, cached);
  }
  return cached;
}

function unproxy(node: ChildNode): ChildNode {
  return (node as ChildNode & { proxyOf?: ChildNode }).proxyOf ?? node;
}

export function isDisabledByComment(node: ChildNode): boolean {
  const prev = node.prev();
  if (prev?.type === 'comment' && prev.text.trim() === DISABLE_COMMENT) return true;

  if (!hasRangeComments(node)) return false;

  let current: ChildNode | undefined = unproxy(node);
  while (current) {
    const parent: Container | Document | undefined = current.parent;
    if (!parent || !parent.nodes) break;
    const nodes = parent.nodes as ChildNode[];
    for (let i = nodes.indexOf(current) - 1; i >= 0; i--) {
      const sibling = nodes[i];
      if (sibling.type === 'comment') {
        const text = sibling.text.trim();
        if (text === RANGE_DISABLE) return true;
        if (text === RANGE_ENABLE) return false;
      }
    }
    current =
      parent.type === 'root' || parent.type === 'document'
        ? undefined
        : (parent as ChildNode);
  }
  return false;
}
