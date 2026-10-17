import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { eldjs: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
  },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 20_000 },
})
