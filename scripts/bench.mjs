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

async function bench(label, opts) {
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await postcss([plugin(opts)]).process(css, { from: undefined });
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
    ).toFixed(1)}ms`,
  );
}
