import type { AtRule } from 'postcss';
import { QUICK_UNIT_TEST } from '../regex';
import { transformValue } from '../transform';
import type { ViewportFallbackOptions } from '../../plugin/types';

export function processSupports(atRule: AtRule, opts: ViewportFallbackOptions) {
  const params = atRule.params;

  if (!params || !QUICK_UNIT_TEST.test(params)) return;

  const fallback = transformValue(params, '@supports', opts);
  if (!fallback || fallback === params) return;

  atRule.cloneBefore({ params: fallback });

  if (opts.debug) {
    console.log(`[viewport-fallback] @supports: ${params} → ${fallback}`);
  }
}
