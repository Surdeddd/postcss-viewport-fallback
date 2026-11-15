import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    isolate: false,
    testTimeout: 30_000,
    env: { PVF_LANG: 'en' },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/plugin/types/**', 'src/index.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
});
