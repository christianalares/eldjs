import { defineConfig } from 'vite'
import devServer from '@hono/vite-dev-server'
import { eld } from '@eldjs/dev/vite'

export default defineConfig({
  plugins: [eld(), devServer({ entry: 'src/app.ts' })],
  build: { ssr: 'src/app.ts', outDir: 'dist', minify: false },
})
