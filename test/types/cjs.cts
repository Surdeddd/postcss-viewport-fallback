import postcss = require('postcss');
import viewportFallback = require('postcss-viewport-fallback');

const options: viewportFallback.ViewportFallbackOptions = { preserve: false };
const isCreator: true = viewportFallback.postcss;

postcss([viewportFallback(options), viewportFallback, viewportFallback.default()]);
void isCreator;
