import type { PropertyFilter, ViewportFallbackOptions } from '../plugin/types';

/** Internal resolved configuration — not exported to consumers. */
export interface ResolvedConfig extends Omit<ViewportFallbackOptions, 'excludeProperties' | 'onlyProperties'> {
  excludeProperties?: PropertyFilter | undefined;
  onlyProperties?: PropertyFilter | undefined;
  unitMap: Record<string, string>;
  unitRegex: RegExp;
  quickTest: RegExp;
  shouldPreserve: boolean;
}
