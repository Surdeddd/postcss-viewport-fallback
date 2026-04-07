import type { AtRule, Result } from 'postcss';
import { processAtRule } from './processAtRule';
import type { ResolvedConfig } from '../config';
import type { TransformStats } from '../../plugin/types';

export function processMedia(
  atRule: AtRule,
  config: ResolvedConfig,
  stats: TransformStats,
  result: Result,
) {
  processAtRule(atRule, 'media', config, stats, result);
}
