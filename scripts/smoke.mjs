import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import postcss from 'postcss';

const NAME = 'postcss-viewport-fallback';
const INPUT = '.a { height: 100dvh; }';
const REPLACED = '.a { height: 100vh; }';
const TWINNED = '.a { height: 100vh; height: 100dvh; }';

const require = createRequire(import.meta.url);
const default_ = require(NAME);

async function transform(plugins) {
  return (await postcss(plugins).process(INPUT, { from: undefined })).css;
}

const checks = {
  async 'require() returns the plugin creator itself'() {
    const creator = require(NAME);
    assert.equal(typeof creator, 'function');
    assert.equal(creator.postcss, true);
    assert.equal(creator.default, creator);
    assert.equal(await transform([creator({ preserve: false })]), REPLACED);
    assert.equal(await transform([creator]), TWINNED);
  },

  async 'postcss-load-config can call the resolved CommonJS entry with options'() {
    const entry = pathToFileURL(require.resolve(NAME)).href;
    const creator = (await import(entry)).default;
    assert.equal(typeof creator, 'function');
    assert.equal(await transform([creator({ preserve: false })]), REPLACED);
    assert.equal(await transform([creator]), TWINNED);
  },

  async 'import returns the plugin creator as default export'() {
    const { default: creator } = await import(NAME);
    assert.equal(typeof creator, 'function');
    assert.equal(creator.postcss, true);
    assert.equal(await transform([creator({ preserve: false })]), REPLACED);
  },

  async 'the runtime entry exports applyViewportVars in both formats'() {
    assert.equal(typeof require(`${NAME}/runtime`).applyViewportVars, 'function');
    assert.equal(typeof (await import(`${NAME}/runtime`)).applyViewportVars, 'function');
  },

  async 'the runtime is ES5 in both formats'() {
    const read = (file) =>
      readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8');
    const esm = read('runtime.js');
    const body = esm.replace(/\nexport \{[^}]*\};?\s*$/, '\n');
    assert.notEqual(body, esm);
    parse(read('runtime.cjs'), { ecmaVersion: 5 });
    parse(body, { ecmaVersion: 5 });
  },

  async 'seed.css is exported and seeds every built-in unit'() {
    const seed = readFileSync(require.resolve(`${NAME}/seed.css`), 'utf8');
    assert.equal(seed.match(/--pvf-[a-z]+: 1v[a-z]+(?=[;\s])/g).length, 18);
    assert.equal(seed.match(/@supports/g).length, 1);
    const css = await transform([default_({ strategy: 'css-var', seed: false })]);
    assert.equal(css, '.a { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }');
  },

  async 'CommonJS types describe module.exports = creator'() {
    const types = readFileSync(new URL('../dist/index.d.cts', import.meta.url), 'utf8');
    assert.match(types, /export = viewportFallback;\s*$/);
    assert.match(types, /export \{ viewportFallback as default \};/);
  },
};

for (const [name, check] of Object.entries(checks)) {
  await check();
  console.log(`ok - ${name}`);
}
