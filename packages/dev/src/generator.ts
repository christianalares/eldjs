import path from 'node:path'
import { watch } from 'chokidar'
import { Generator } from './vendor/generator/generator.js'
import { getConfig } from './vendor/generator/config.js'
import type { Config } from './vendor/generator/config.js'

export interface GeneratorOptions {
  root?: string
  routesDirectory?: string
  generatedRouteTree?: string
  routeFileIgnorePrefix?: string
  routeFileIgnorePattern?: string
  virtualRouteConfig?: Config['virtualRouteConfig']
  /** Defaults to .js for Node-compatible output. */
  addExtensions?: Config['addExtensions']
}
export function createGenerator(options: GeneratorOptions = {}) {
  const { root: directory, ...config } = options
  const root = path.resolve(directory ?? process.cwd())
  return new Generator({
    root,
    config: getConfig(
      {
        ...config,
        target: 'api',
        autoCodeSplitting: false,
        tmpDir: path.join(root, '.eld/tmp'),
        addExtensions: config.addExtensions ?? '.js',
        disableLogging: true,
      },
      root,
    ),
  })
}
export async function generate(options: GeneratorOptions = {}) {
  const generator = createGenerator(options)
  await generator.run()
  return generator
}
/** Initial generation completes before the returned watcher is ready for use. */
export async function watchRoutes(
  options: GeneratorOptions = {},
  onError: (error: unknown) => void = console.error,
) {
  const generator = await generate(options)
  const watcher = watch(generator.getWatchPaths(), { ignoreInitial: true })
  watcher.on('all', (event, file) => {
    if (event === 'add' || event === 'change' || event === 'unlink') {
      void generator
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
          watcher.add(generator.getWatchPaths())
        })
        .catch(onError)
    }
  })
  await new Promise<void>((resolve, reject) => {
    watcher.once('ready', resolve)
    watcher.once('error', reject)
  })
  // Reconcile changes made between initial generation and watcher readiness.
  await generator.run()
  return watcher
}
