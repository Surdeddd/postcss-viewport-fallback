import type { Declaration } from 'postcss';
import { QUICK_UNIT_TEST } from '../regex';
import { transformValue } from '../transform';
import type { ViewportFallbackOptions } from '../../plugin/types';

export function processDeclaration(decl: Declaration, opts: ViewportFallbackOptions) {
  const original = decl.value;
  const prop = decl.prop;
  if (opts.debug) {
    console.log(`[viewport-fallback] checking: ${prop} = ${original}`);
  }

  if (!QUICK_UNIT_TEST.test(original)) return;
  if (prop.startsWith('--') && !opts.includeCustomProps) return;

  if (opts.onlyProperties && !opts.onlyProperties.includes(prop)) return;
  if (opts.excludeProperties && opts.excludeProperties.includes(prop)) return;

  const fallback = transformValue(original, prop, opts);
  if (!fallback) return;

  // 🔥 debug actual transform
  if (opts.debug) {
    console.log(`[viewport-fallback] ${prop}: ${original} → ${fallback}`);
  }

  opts.onTransform?.({
    prop,
    original,
    fallback,
    file: decl.source?.input.file,
    selector: decl.parent?.toString(),
    loc: decl.source?.start,
  });

  decl.cloneBefore({ value: fallback });

  if (opts.replace) decl.remove();
}
