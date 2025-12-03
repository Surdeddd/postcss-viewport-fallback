import type { AtRule } from 'postcss';
import type { ViewportFallbackOptions } from '../../plugin/types';
import { QUICK_UNIT_TEST } from '../regex';
import { transformValue } from '../transform';

export function processContainer(atRule: AtRule, opts: ViewportFallbackOptions) {
  const params = atRule.params;
  if (!params || !QUICK_UNIT_TEST.test(params)) return;

  const fallback = transformValue(params, '@container', opts);
  if (!fallback || fallback === params) return;

  atRule.cloneBefore({ params: fallback });

  if (opts.debug) {
    console.log(`[viewport-fallback] @container: ${params} → ${fallback}`);
  }
}
