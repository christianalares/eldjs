#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { generate, watchRoutes } from './generator.js'

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      routesDirectory: { type: 'string' },
      generatedRouteTree: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  const command = positionals[0] ?? 'generate'
  if (values.help) {
    console.log(
      'Usage: eld [generate|watch] [--root directory] [--routesDirectory directory] [--generatedRouteTree file]',
    )
  } else if (
    positionals.length > 1 ||
    !['generate', 'watch'].includes(command)
  ) {
    throw new Error(
      'Expected eld generate or eld watch. Run eld --help for options.',
    )
  } else {
    const { help, ...options } = values
    if (command === 'generate') await generate(options)
    else {
      const watcher = await watchRoutes(options)
      console.log('Watching API routes…')
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.once(signal, () => {
          void watcher.close().then(() => process.exit(0))
        })
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
