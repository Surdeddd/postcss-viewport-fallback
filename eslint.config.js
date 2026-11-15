import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

const es5Only = [
  ['ArrowFunctionExpression', 'arrow functions'],
  ['TemplateLiteral', 'template literals'],
  ['ChainExpression', 'optional chaining'],
  ["LogicalExpression[operator='??']", 'nullish coalescing'],
  ["VariableDeclaration[kind!='var']", 'let/const'],
  ['SpreadElement', 'spread'],
  ['RestElement', 'rest parameters'],
  ['ForOfStatement', 'for-of'],
  ['ClassDeclaration', 'classes'],
  ['ClassExpression', 'classes'],
  ['ObjectPattern', 'destructuring'],
  ['ArrayPattern', 'destructuring'],
  ['AssignmentPattern', 'default parameters'],
  ['Property[shorthand=true]', 'shorthand properties'],
  ['Property[method=true]', 'shorthand methods'],
  ['Property[computed=true]', 'computed keys'],
].map(([selector, name]) => ({
  selector,
  message: `The runtime ships to legacy browsers untranspiled: no ${name}, ES5 syntax only.`,
}));

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      'coverage/**',
      '.remember/**',
      '.claude/**',
      'MEMORY_BANK/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['scripts/data/capture-shorthands.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/runtime.ts'],
    rules: {
      'no-var': 'off',
      'no-restricted-syntax': ['error', ...es5Only],
    },
  },
  prettierConfig
);
