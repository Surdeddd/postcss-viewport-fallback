import type { AtRule, Result } from 'postcss';
import { processAtRule } from './processAtRule';
import type { ResolvedConfig } from '../config';
import type { TransformStats } from '../../plugin/types';

export function processSupports(
  atRule: AtRule,
  config: ResolvedConfig,
  stats: TransformStats,
  result: Result,
) {
  processAtRule(atRule, 'supports', config, stats, result);
}
