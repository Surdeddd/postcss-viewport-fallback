import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { build } from 'tsup';
import viewportFallback from '../dist/index.js';

const at = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const OUT = at('playground/dist');
const FONTS = { 'ibm-plex-sans': [400, 500], 'ibm-plex-mono': [400, 500] };
const NEEDED = /-(latin|cyrillic)-\d+-normal\.woff2$/;

/** The @font-face rules of the subsets the page needs; their files are copied next to it. */
function fontFaces() {
  const rules = [];
  for (const [family, weights] of Object.entries(FONTS)) {
    const folder = at(`node_modules/@fontsource/${family}`);
    for (const weight of weights) {
      const sheet = postcss.parse(readFileSync(`${folder}/${weight}.css`, 'utf8'));
      sheet.walkAtRules('font-face', (face) => {
        let file;
        face.walkDecls('src', (src) => {
          file = /files\/([\w-]+\.woff2)/.exec(src.value)?.[1];
          src.value = `url(fonts/${file}) format('woff2')`;
        });
        if (!file || !NEEDED.test(file)) return;
        cpSync(`${folder}/files/${file}`, `${OUT}/fonts/${file}`);
        rules.push(face.toString());
      });
    }
  }
  return rules.join('\n');
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/fonts`, { recursive: true });

const styles = `${fontFaces()}\n${readFileSync(at('playground/styles.css'), 'utf8')}`;
const { css } = await postcss([viewportFallback()]).process(styles, { from: undefined });
writeFileSync(`${OUT}/styles.css`, css);
cpSync(at('playground/index.html'), `${OUT}/index.html`);

await build({
  entry: { app: at('playground/main.ts') },
  outDir: OUT,
  format: ['iife'],
  platform: 'browser',
  target: 'es2020',
  minify: true,
  clean: false,
  config: false,
  dts: false,
  silent: true,
  removeNodeProtocol: false,
  noExternal: [/.*/],
  outExtension: () => ({ js: '.js' }),
  esbuildOptions(options) {
    const nothing = at('playground/shims/empty.ts');
    options.alias = {
      'node:path': at('playground/shims/path.ts'),
      'node:module': at('playground/shims/module.ts'),
      'source-map-js': nothing,
      path: nothing,
      url: nothing,
      fs: nothing,
    };
    options.define = { ...options.define, 'import.meta.url': '"file:///"' };
  },
});

console.log(`playground written to ${OUT}`);
