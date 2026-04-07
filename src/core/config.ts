import type { ViewportFallbackOptions } from '../plugin/types';

/** Internal resolved configuration — not exported to consumers. */
export interface ResolvedConfig extends ViewportFallbackOptions {
  unitMap: Record<string, string>;
  unitRegex: RegExp;
  quickTest: RegExp;
  shouldPreserve: boolean;
}
