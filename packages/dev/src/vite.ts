import path from 'node:path'
import type { Plugin } from 'vite'
import { createGenerator } from './generator.js'
import type { GeneratorOptions } from './generator.js'

/** Generate the route graph before Vite loads the app, and update it during development. */
export function eld(options: GeneratorOptions = {}): Plugin {
  let generator: ReturnType<typeof createGenerator>
  let pending: Promise<void> = Promise.resolve()
  return {
    name: 'eldjs:routes',
    enforce: 'pre',
    async configResolved(config) {
      generator = createGenerator({
        ...options,
        root: options.root ?? config.root,
      })
      await generator.run()
    },
    configureServer(server) {
      server.watcher.add(generator.getWatchPaths())
      const onChange = (event: string, file: string) => {
        if (!['add', 'change', 'unlink'].includes(event)) return
        if (path.resolve(file) === generator.config.generatedRouteTree) return
        pending = generator
          .run({
            type:
              event === 'unlink'
                ? 'delete'
                : event === 'add'
                  ? 'create'
                  : 'update',
            path: path.resolve(file),
          })
          .then(() => {
            server.watcher.add(generator.getWatchPaths())
            server.moduleGraph.invalidateAll()
          })
        // Keep the rejection available to the request middleware while preventing an unhandled rejection.
        void pending.catch((error) => server.config.logger.error(String(error)))
      }
      server.watcher.on('all', onChange)
      server.httpServer?.once('close', () =>
        server.watcher.off('all', onChange),
      )
      server.middlewares.use((_request, _response, next) => {
        void pending.then(() => next(), next)
      })
    },
  }
}
export default eld
