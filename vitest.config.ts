import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: [
      'src/shared/__tests__/**/*.test.ts',
      'src/main/lib/__tests__/**/*.test.ts',
      'src/renderer/lib/__tests__/**/*.test.ts'
    ],
    environment: 'node',
    globals: false
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
});
