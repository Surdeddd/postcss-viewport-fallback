import type { PropertyFilter, ViewportFallbackOptions } from '../plugin/types';
import type { FallbackStrategy } from './parser';

/** Internal resolved configuration — not exported to consumers. */
export interface ResolvedConfig extends Omit<ViewportFallbackOptions, 'excludeProperties' | 'onlyProperties'> {
  excludeProperties?: PropertyFilter | undefined;
  onlyProperties?: PropertyFilter | undefined;
  strategy: FallbackStrategy;
  unitMap: Record<string, string>;
  unitRegex: RegExp;
  quickTest: RegExp;
  shouldPreserve: boolean;
}
