import { rmSync } from 'node:fs';
import { defineConfig } from 'tsup';

rmSync('dist', { recursive: true, force: true });

const formats = ['esm', 'cjs'] as const;

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: [...formats],
    dts: true,
    shims: true,
    footer: ({ format }) =>
      format === 'cjs'
        ? {
            js: 'module.exports = Object.assign(module.exports.default, { default: module.exports.default });',
          }
        : {},
  },
  {
    entry: ['src/runtime.ts'],
    format: [...formats],
    platform: 'browser',
    dts: true,
    esbuildOptions(options) {
      options.target = 'es5';
    },
  },
]);
