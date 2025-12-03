import type { Root } from 'postcss';
import { DEFAULT_OPTIONS } from '../core/defaults';
import type { ViewportFallbackOptions } from './types';

import {
  processContainer,
  processDeclaration,
  processMedia,
  processSupports,
} from '../core/process';

export default function viewportFallback(options: ViewportFallbackOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return {
    postcssPlugin: 'postcss-viewport-fallback',

    Once(root: Root) {
      root.walkDecls((decl) => processDeclaration(decl, opts));
      root.walkAtRules('media', (rule) => processMedia(rule, opts));
      root.walkAtRules('supports', (rule) => processSupports(rule, opts));
      root.walkAtRules('container', (rule) => processContainer(rule, opts));
    },
  };
}

viewportFallback.postcss = true;
