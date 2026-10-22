import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      '.next/**',
      'output/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      '.orchestra/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // CommonJS runtime helpers (Node --require hooks and test runtimes) can only load with require().
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  prettier,
];

export default config;
