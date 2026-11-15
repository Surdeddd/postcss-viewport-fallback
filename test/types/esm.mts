import postcss from 'postcss';
import viewportFallback from 'postcss-viewport-fallback';
import type {
  TransformMeta,
  TransformStats,
  ViewportFallbackOptions,
} from 'postcss-viewport-fallback';
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';

const options: ViewportFallbackOptions = {
  strategy: 'css-var',
  onTransform: (meta: TransformMeta) => void meta.selector,
  onComplete: (stats: TransformStats) => void stats.skipped,
};

postcss([viewportFallback(options), viewportFallback]);
applyViewportVars();
