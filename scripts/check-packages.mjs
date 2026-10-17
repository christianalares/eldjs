import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspace = fileURLToPath(new URL('../', import.meta.url))
const temporary = await mkdtemp(path.join(os.tmpdir(), 'eld-packages-'))
const consumer = path.join(temporary, 'consumer')

function run(command, args, cwd = consumer) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    })
  } catch (error) {
    console.error(error.stdout?.toString(), error.stderr?.toString())
    throw error
  }
}

async function file(name, contents) {
  const destination = path.join(consumer, name)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, contents)
}

try {
  console.log('Packing the runtime and development tooling…')
  const runtimeTarball = path.join(temporary, 'eldjs.tgz')
  const toolingTarball = path.join(temporary, 'eldjs-dev.tgz')
  run(
    'pnpm',
    ['pack', '--out', runtimeTarball],
    path.join(workspace, 'packages/eldjs'),
  )
  run(
    'pnpm',
    ['pack', '--out', toolingTarball],
    path.join(workspace, 'packages/dev'),
  )

  for (const tarball of [runtimeTarball, toolingTarball]) {
    const files = run('tar', ['-tzf', tarball], workspace).trim().split('\n')
    for (const required of [
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'README.md',
      'package.json',
    ]) {
      assert.ok(
        files.includes(`package/${required}`),
        `Missing ${required} in ${tarball}`,
      )
    }
    assert.ok(
      files.every((file) =>
        /^package\/(?:dist\/|src\/|LICENSE$|THIRD_PARTY_NOTICES\.md$|README\.md$|package\.json$)/.test(
          file,
        ),
      ),
      `Unexpected files in ${tarball}`,
    )
    // Both JavaScript and declaration maps must resolve inside the published package.
    for (const mapFile of files.filter((file) => file.endsWith('.map'))) {
      const map = JSON.parse(run('tar', ['-xOf', tarball, mapFile], workspace))
      for (const source of map.sources) {
        const resolved = path.posix.normalize(
          path.posix.join(
            path.posix.dirname(mapFile),
            map.sourceRoot ?? '',
            source,
          ),
        )
        assert.ok(
          files.includes(resolved),
          `Missing source-map target ${resolved}`,
        )
      }
    }
  }

  // An external consumer must resolve both real tarballs, without workspace aliases.
  await file(
    'package.json',
    JSON.stringify(
      {
        name: 'eld-package-consumer',
        private: true,
        type: 'module',
        dependencies: {
          eldjs: `file:${runtimeTarball}`,
          hono: '4.13.7', // The oldest declared peer version; the workspace tests 4.13.13.
          valibot: '1.5.0', // Prove that runtime validation does not require Zod.
        },
        devDependencies: {
          '@eldjs/dev': `file:${toolingTarball}`,
          '@types/node': '^22.0.0',
          typescript: '~5.9.3',
        },
      },
      null,
      2,
    ),
  )
  await file(
    'tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          strict: true,
          skipLibCheck: false,
          rootDir: 'src',
          outDir: 'dist',
          declaration: true,
        },
        include: ['src'],
      },
      null,
      2,
    ),
  )
  await file(
    'src/routes/__root.ts',
    `
    import { createRootRoute } from 'eldjs'
    export const Route = createRootRoute()
  `,
  )
  await file(
    'src/routes/items.$id.ts',
    String.raw`
    import { createFileRoute } from 'eldjs'
    import * as v from 'valibot'
    import { createItem } from '../handlers.js'
    export const Route = createFileRoute('/stale')({
      handlers: ({ createHandlers }) => createHandlers({
        GET: {
          validate: { params: { id: v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number)) } },
          handler: ({ c, params, input }) => {
            const id: number = input.params.id
            return c.json({ raw: params.id, id }, 200)
          },
        },
        POST: createItem,
      }),
    })
  `,
  )
  await file(
    'src/handlers.ts',
    `
    import { createHandler } from 'eldjs'
    import * as v from 'valibot'
    export const createItem = createHandler({
      validate: { json: v.object({ title: v.pipe(v.string(), v.trim(), v.minLength(1)) }) },
      handler: ({ c, input }) => c.json({ title: input.json.title }, 201),
    })
  `,
  )
  await file(
    'src/app.ts',
    `
    import { Hono } from 'hono'
    import { createApp } from 'eldjs'
    import { routeTree } from './routeTree.gen.js'
    const hono = new Hono()
    hono.use('*', async (c, next) => { await next(); c.header('x-native-hono', 'yes') })
    const app = createApp({ hono, routeTree })
    export type App = typeof app
    export default app
  `,
  )
  await file(
    'src/client.ts',
    `
    import { hc } from 'hono/client'
    import type { App } from './app.js'
    export const client = hc<App>('http://localhost')
    export async function checkClientTypes() {
      const response = await client.items[':id'].$get({ param: { id: '007' } })
      if (!response.ok) {
        const error: 'VALIDATION_ERROR' = (await response.json()).error
        throw new Error(error)
      }
      const body = await response.json()
      const id: number = body.id
      const raw: string = body.raw
      return { id, raw }
    }
  `,
  )
  await file(
    'verify.mjs',
    `
    import assert from 'node:assert/strict'
    import app from './dist/app.js'
    const response = await app.request('/items/007')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-native-hono'), 'yes')
    assert.deepEqual(await response.json(), { raw: '007', id: 7 })
    const post = await app.request('/items/007', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: ' hello ' }),
    })
    assert.equal(post.status, 201)
    assert.deepEqual(await post.json(), { title: 'hello' })
    assert.equal((await app.request('/items/invalid')).status, 400)
    assert.equal((await app.request('/missing')).status, 404)
  `,
  )

  console.log(
    'Installing tarballs, generating routes, and compiling the consumer…',
  )
  run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'])
  run(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict'
    import { generate } from '@eldjs/dev'
    import { eld } from '@eldjs/dev/vite'
    assert.equal(typeof generate, 'function')
    assert.equal(eld().name, 'eldjs:routes')
  `,
  ])
  run('pnpm', ['exec', 'eld', 'generate'])
  assert.match(
    await readFile(path.join(consumer, 'src/routes/items.$id.ts'), 'utf8'),
    /createFileRoute\('\/items\/\$id'\)/,
  )
  run('pnpm', ['exec', 'tsc'])
  run(process.execPath, ['verify.mjs'])

  // Use a clean install, so leftover tooling cannot hide a missing runtime dependency.
  console.log(
    'Installing only production dependencies and running the built API…',
  )
  await rm(path.join(consumer, 'node_modules'), {
    recursive: true,
    force: true,
  })
  run('pnpm', ['install', '--ignore-workspace', '--prod', '--frozen-lockfile'])
  run(process.execPath, ['verify.mjs'])
  assert.equal(
    existsSync(path.join(consumer, 'node_modules/@eldjs/dev')),
    false,
  )
  assert.equal(existsSync(path.join(consumer, 'node_modules/.bin/eld')), false)
  assert.equal(
    existsSync(path.join(consumer, 'node_modules/eldjs/dist/cli.js')),
    false,
  )
  assert.equal(
    existsSync(path.join(consumer, 'node_modules/eldjs/dist/vendor/generator')),
    false,
  )
  const [installed] = JSON.parse(
    run('pnpm', ['list', '--prod', '--depth', 'Infinity', '--json']),
  )
  const names = new Set()
  function collect(tree) {
    for (const [name, entry] of Object.entries(tree.dependencies ?? {})) {
      names.add(name)
      collect(entry)
    }
  }
  collect(installed)
  // Valibot keeps its optional TypeScript peer when it was resolved in the build
  // lockfile. That dependency belongs to the chosen schema library, not Eld.
  assert.deepEqual([...names].sort(), [
    '@standard-schema/spec',
    'eldjs',
    'hono',
    'typescript',
    'valibot',
  ])
  assert.deepEqual(
    Object.keys(installed.dependencies.eldjs.dependencies).sort(),
    ['@standard-schema/spec', 'hono'],
  )
  console.log(
    'Passed: CLI, public exports, generated types, Hono 4.13.7 integration, and runtime without Eld tooling or Zod.',
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
