import type {
  AtRule,
  ChildNode,
  Container,
  Declaration,
  Result,
  Root,
  Rule,
} from 'postcss';
import type { TransformStats } from '../plugin/types';
import { createCommentControl } from './controlComments';
import type { CommentControl } from './controlComments';

export interface GuardSlot {
  guard: AtRule;
  /** Where the guarded declarations live: the copied rule, or the guard itself when nested. */
  body: Rule | AtRule;
  declBefore: string | undefined;
  /** Declarations of the guarded rule mapped to their copies inside the guard. */
  held: Map<Declaration, Declaration>;
}

export type GuardPlacement = 'after-rule' | 'nested' | 'impossible';

/** The guards of neighbouring declarations that share one ladder of conditions. */
export interface GuardGroup {
  key: string;
  slots: GuardSlot[];
}

export interface CustomSlot {
  condition: string;
  level: number;
  slot: GuardSlot;
}

export interface RuleGuards {
  /** Groups of regular declarations, in the source order of those declarations. */
  groups: GuardGroup[];
  /** Guards of custom properties, one per condition, as they stand in the file: weakest first. */
  customSlots: CustomSlot[];
  tail: ChildNode;
}

/** State of a single process() run; never shared between concurrent runs. */
export interface RunContext {
  result: Result;
  stats: TransformStats;
  usedUnits: Map<Root, Set<string>>;
  comments: CommentControl;
  supportsCache: Map<string, readonly string[]>;
  ruleGuards: WeakMap<Rule, RuleGuards>;
  nestedGuards: WeakMap<Container, GuardGroup>;
  /** Copies of a late-validated declaration that wait in the guards of earlier ones. */
  followerCopies: WeakMap<Declaration, Declaration[]>;
  /** Such a copy while its source is not lowered yet: it is left alone until then. */
  waiting: WeakSet<Declaration>;
  /** `@keyframes` and `@property` rules this run repeated under `@supports`. */
  repeated: WeakSet<AtRule>;
  /**
   * Handled nodes mapped to what was written in front of them: their twin, or the comment
   * of a switched-off copy. Null when nothing was needed.
   */
  handled: WeakMap<ChildNode, ChildNode | null>;
  generated: WeakSet<ChildNode>;
}

export function emptyStats(): TransformStats {
  return { declarations: 0, atRules: 0, skipped: 0, timeMs: 0 };
}

export function createRunContext(result: Result): RunContext {
  return {
    result,
    stats: emptyStats(),
    usedUnits: new Map(),
    comments: createCommentControl(),
    supportsCache: new Map(),
    ruleGuards: new WeakMap(),
    nestedGuards: new WeakMap(),
    followerCopies: new WeakMap(),
    waiting: new WeakSet(),
    repeated: new WeakSet(),
    handled: new WeakMap(),
    generated: new WeakSet(),
  };
}

/** Remember which `--pvf-*` variables the css-var rewrites in a node's stylesheet rely on. */
export function markUnitsUsed(
  ctx: RunContext,
  node: ChildNode,
  units: readonly string[]
): void {
  const root = node.root();
  let used = ctx.usedUnits.get(root);
  if (!used) {
    used = new Set();
    ctx.usedUnits.set(root, used);
  }
  for (const unit of units) used.add(unit);
}
