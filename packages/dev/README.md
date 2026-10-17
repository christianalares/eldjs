# Eld development tooling

Route generation, watching, the `eld` CLI, and a Vite plugin for Eld APIs. Install `@eldjs/dev` as a development dependency alongside the `eldjs` runtime. Applications import routes, handlers, and middleware from `eldjs`.

Export `Route = createRootRoute()` from `src/routes/__root.ts`, then generate the route graph:

```sh
pnpm exec eld generate
pnpm exec eld watch
pnpm exec eld generate --root ./apps/api
```

The CLI works without Vite. `eld.config.json` supports route directories, generated-file paths, ignore patterns, and virtual routes. Restart watching after changing this configuration file.

For Vite, install Vite as a development dependency and enable the plugin:

```ts
import { defineConfig } from 'vite'
import { eld } from '@eldjs/dev/vite'

export default defineConfig({
  plugins: [eld()],
  build: { ssr: 'src/app.ts' },
})
```

The plugin generates before the app loads and watches route changes during development. Add a server adapter such as `@hono/vite-dev-server` to serve the API in development; production hosting uses the built app's Fetch handler.

Programmatic access uses the package root:

```ts
import { generate, watchRoutes } from '@eldjs/dev'

await generate({ root: process.cwd() })
const watcher = await watchRoutes({ root: process.cwd() })
await watcher.close()
```

Generated route files continue to import from `eldjs`. This package and its compiler dependencies are only needed while generating and building the app, and can be omitted from production installs. The CLI currently offers generation and watching, not project scaffolding.

The generator is adapted from TanStack Router's MIT-licensed source. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for provenance and the upstream license.
