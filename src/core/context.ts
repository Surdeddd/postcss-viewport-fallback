import type { Node } from 'postcss';
import type { TransformStats } from '../plugin/types';
import type { TransformContext } from './transform';

/** Per-process() run state — never shared across concurrent runs. */
export interface RunContext {
  stats: TransformStats;
  usedUnits: Set<string>;
  generated: WeakSet<Node>;
  transformCtx: TransformContext;
}
