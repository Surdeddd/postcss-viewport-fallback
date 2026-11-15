import postcss from 'postcss';
import plugin from '../dist/index.js';

const RULES = 20_000;
const WITH_UNITS_EVERY = 10;

let css = '';
for (let i = 0; i < RULES; i++) {
  css +=
    i % WITH_UNITS_EVERY === 0
      ? `.r${i} { height: calc(100dvh - ${i}px); width: 50dvw; }\n`
      : `.r${i} { color: #fff; padding: ${i % 40}px; margin: 0 auto; }\n`;
}

async function bench(label, opts, input = css) {
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await postcss([plugin(opts)]).process(input, { from: undefined });
    runs.push(performance.now() - start);
  }
  const best = Math.min(...runs).toFixed(1);
  const avg = (runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(1);
  console.log(`${label.padEnd(28)} best ${best}ms  avg ${avg}ms`);
}

console.log(`bench: ${RULES} rules, units in every ${WITH_UNITS_EVERY}th rule\n`);
await bench('default', {});
await bench('preserve: false', { preserve: false });
await bench('fastSkip (units present)', { fastSkip: true });
await bench('css-var', { strategy: 'css-var' });

const ranged =
  '/* postcss-viewport-fallback: disable */\n.x { height: 1dvh; }\n/* postcss-viewport-fallback: enable */\n' +
  css;
await bench('one control-comment range', {}, ranged);

let queries = '';
for (let i = 0; i < 4_000; i++) {
  queries += `@media (min-height: ${(i % 90) + 10}dvh) { .m${i} { height: 100dvh; } }\n`;
}
await bench('4k @media with units', {}, queries);

let guarded = '';
for (let i = 0; i < RULES; i++) {
  guarded +=
    i % WITH_UNITS_EVERY === 0
      ? `.g${i} { height: calc(100dvh - var(--h)); display: flex; margin: 0 auto; }\n`
      : `.g${i} { color: #fff; padding: ${i % 40}px; margin: 0 auto; }\n`;
}
await bench('var() in every 10th rule', {}, guarded);

let plainCss = css.replaceAll('dvh', 'vh').replaceAll('dvw', 'vw');
const plain = postcss([plugin({})]);
const fast = postcss([plugin({ fastSkip: true })]);
for (const [label, proc] of [
  ['no units, default', plain],
  ['no units, fastSkip', fast],
]) {
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await proc.process(plainCss, { from: undefined });
    runs.push(performance.now() - start);
  }
  console.log(
    `${label.padEnd(28)} best ${Math.min(...runs).toFixed(1)}ms  avg ${(
      runs.reduce((a, b) => a + b, 0) / runs.length
    ).toFixed(1)}ms`
  );
}
