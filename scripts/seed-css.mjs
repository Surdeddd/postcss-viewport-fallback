import { writeFileSync } from 'node:fs';
import postcss from 'postcss';
import viewportFallback from '../dist/index.js';

const variants = ['d', 's', 'l'];
const classic = ['vw', 'vh', 'vi', 'vb', 'vmin', 'vmax'];
const units = variants.flatMap((variant) => classic.map((unit) => variant + unit));

const { root } = await postcss([
  viewportFallback({ strategy: 'css-var', preserve: false }),
]).process(`.probe { ${units.map((unit) => `top: 1${unit}`).join('; ')} }`, {
  from: undefined,
});

const seed = root.nodes
  .filter((node) => node.type !== 'rule' || node.selector !== '.probe')
  .map((node) => node.toString())
  .join('\n');

if (units.some((unit) => !seed.includes(`--pvf-${unit}:`))) {
  throw new Error('dist/seed.css would miss a unit; check scripts/seed-css.mjs');
}

writeFileSync(new URL('../dist/seed.css', import.meta.url), `${seed}\n`);
