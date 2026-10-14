import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/ui/**/*.test.{ts,tsx}',
      'tests/db/**/*.test.ts',
      'tests/storage/**/*.test.ts',
      'src/**/*.test.{ts,tsx}',
    ],
  },
});
