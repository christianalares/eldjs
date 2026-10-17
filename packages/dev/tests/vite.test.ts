import { expect, test } from 'vitest'
import { createServer } from 'vite'
import devServer from '@hono/vite-dev-server'
import { mkdtemp, mkdir, writeFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { eld } from '../src/vite.js'

test('Vite serves new, edited, renamed and deleted route files without restarting', async () => {
  // Inside the workspace so Vite resolves the package's dependencies normally.
  const root = await mkdtemp(path.resolve('.eld-vite-test-'))
  let server: Awaited<ReturnType<typeof createServer>> | undefined
  try {
    await mkdir(path.join(root, 'src/routes'), { recursive: true })
    await writeFile(
      path.join(root, 'src/routes/__root.ts'),
      "import { createRootRoute } from '@eldjs/core'; export const Route = createRootRoute()",
    )
    await writeFile(
      path.join(root, 'src/app.ts'),
      "import { createApp } from '@eldjs/core'; import { routeTree } from './routeTree.gen.js'; export default createApp({ routeTree })",
    )
    const initialRoutes: Record<string, string> = {
      '_private.ts':
        "import { createFileRoute, createMiddleware } from '@eldjs/core'; const auth = createMiddleware().server(({ request, next }) => request.headers.has('authorization') ? next() : new Response('Unauthorized', { status: 401 })); export const Route = createFileRoute('/_private')({ middleware: [auth] })",
      '_private.me.ts':
        "import { createFileRoute } from '@eldjs/core'; export const Route = createFileRoute('/_private/me')({ handlers: { GET: ({ c }) => c.json({ private: true }) } })",
      '(meta).info.ts':
        "import { createFileRoute } from '@eldjs/core'; export const Route = createFileRoute('/(meta)/info')({ handlers: { GET: ({ c }) => c.text('info') } })",
      'teams.ts':
        "import { createFileRoute, createMiddleware } from '@eldjs/core'; const scope = createMiddleware().server(({ next }) => next({ context: { scope: 'team' } })); export const Route = createFileRoute('/teams')({ middleware: [scope] })",
      'teams.$id.ts':
        "import { createFileRoute } from '@eldjs/core'; export const Route = createFileRoute('/teams/$id')({ handlers: { GET: ({ c, context, params }) => c.json({ scope: context.scope, id: params.id }) } })",
      'teams_.$id.audit.ts':
        "import { createFileRoute } from '@eldjs/core'; export const Route = createFileRoute('/teams_/$id/audit')({ handlers: { GET: ({ c, context }) => c.json({ scope: context.scope ?? null }) } })",
    }
    for (const [name, content] of Object.entries(initialRoutes))
      await writeFile(path.join(root, 'src/routes', name), content)
    server = await createServer({
      configFile: false,
      root,
      logLevel: 'error',
      plugins: [eld(), devServer({ entry: 'src/app.ts' })],
      server: { port: 0, host: '127.0.0.1' },
    })
    await server.listen()
    const address = server.httpServer!.address() as { port: number }
    const url = `http://127.0.0.1:${address.port}`
    expect((await fetch(`${url}/me`)).status).toBe(401)
    expect(
      await (
        await fetch(`${url}/me`, { headers: { authorization: 'test' } })
      ).json(),
    ).toEqual({ private: true })
    expect(await (await fetch(`${url}/info`)).text()).toBe('info')
    expect(await (await fetch(`${url}/teams/1`)).json()).toEqual({
      scope: 'team',
      id: '1',
    })
    expect(await (await fetch(`${url}/teams/1/audit`)).json()).toEqual({
      scope: null,
    })
    const routeFile = path.join(root, 'src/routes/hello.ts')
    const content = (value: string) =>
      `import { createFileRoute } from '@eldjs/core'; export const Route = createFileRoute('/hello')({ handlers: { GET: ({ c }) => c.json({ value: '${value}' }) } })`
    expect((await fetch(`${url}/hello`)).status).toBe(404)
    await writeFile(routeFile, content('first'))
    await expect
      .poll(async () => (await fetch(`${url}/hello`)).json())
      .toEqual({ value: 'first' })
    await writeFile(routeFile, content('second'))
    await expect
      .poll(async () => (await fetch(`${url}/hello`)).json())
      .toEqual({ value: 'second' })
    await rename(routeFile, path.join(root, 'src/routes/renamed.ts'))
    await expect
      .poll(async () => (await fetch(`${url}/renamed`)).json())
      .toEqual({ value: 'second' })
    expect((await fetch(`${url}/hello`)).status).toBe(404)
    await rm(path.join(root, 'src/routes/renamed.ts'))
    await expect
      .poll(async () => (await fetch(`${url}/renamed`)).status)
      .toBe(404)
  } finally {
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
})
