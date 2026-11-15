import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/index.d.cts', import.meta.url);
const source = readFileSync(file, 'utf8');
const esmExports =
  /export \{ viewportFallback as default \};\nexport type \{([^}]+)\};\s*$/;

if (!esmExports.test(source)) {
  throw new Error(
    'dist/index.d.cts no longer ends with the expected export block; update scripts/cjs-types.mjs'
  );
}

writeFileSync(
  file,
  source.replace(
    esmExports,
    (_match, types) =>
      `declare namespace viewportFallback {\n` +
      `    export { viewportFallback as default };\n` +
      `    export type {${types}};\n` +
      `}\n\n` +
      `export = viewportFallback;\n`
  )
);
