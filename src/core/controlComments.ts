import type { ChildNode, Comment, Container, Root } from 'postcss';
import { PLUGIN_NAME } from './constants';

type Directive = 'off' | 'disable' | 'enable';
type RangeState = boolean | null;

const DIRECTIVE = /^postcss-viewport-fallback\s*:\s*(off|disable|enable)$/i;

function directiveOf(node: ChildNode | undefined): Directive | undefined {
  if (!node || node.type !== 'comment') return undefined;
  const match = DIRECTIVE.exec(node.text.trim());
  return match ? (match[1].toLowerCase() as Directive) : undefined;
}

/** The text of the comment that switches off the node after it. */
export const SWITCH_OFF = `${PLUGIN_NAME}: off`;

export interface CommentControl {
  /** Register a comment; a range directive indexes its container anew. */
  observe(comment: Comment): void;
  /** True when a point `off` comment or an enclosing `disable` range covers the node. */
  isDisabled(node: ChildNode): boolean;
}

/** Per-run view of control comments, built from the comments PostCSS visits. */
export function createCommentControl(): CommentControl {
  const rootsWithRanges = new WeakSet<Root>();
  const rangeHosts = new WeakSet<Container>();
  const states = new WeakMap<ChildNode, RangeState>();

  function indexHost(host: Container): void {
    let state: RangeState = null;
    for (const child of host.nodes as ChildNode[]) {
      const directive = directiveOf(child);
      if (directive === 'disable') state = true;
      else if (directive === 'enable') state = false;
      else states.set(child, state);
    }
    rangeHosts.add(host);
  }

  /** A node the index does not know was written later: it has the state its neighbour leaves it. */
  function stateWithin(node: ChildNode, host: Container): RangeState {
    const known = states.get(node);
    if (known !== undefined) return known;

    const before = node.prev();
    const directive = directiveOf(before);
    const state =
      directive === 'disable' || directive === 'enable'
        ? directive === 'disable'
        : before
          ? stateWithin(before, host)
          : null;
    states.set(node, state);
    return state;
  }

  return {
    observe(comment) {
      const directive = directiveOf(comment);
      if (directive === 'disable' || directive === 'enable') {
        indexHost(comment.parent as Container);
        rootsWithRanges.add(comment.root());
      }
    },

    isDisabled(node) {
      if (directiveOf(node.prev()) === 'off') return true;
      if (!rootsWithRanges.has(node.root())) return false;

      for (let current = node; ;) {
        const parent = current.parent as Container;
        if (rangeHosts.has(parent)) {
          const state = stateWithin(current, parent);
          if (state !== null) return state;
        }
        if (parent.type === 'root') return false;
        current = parent as ChildNode;
      }
    },
  };
}
