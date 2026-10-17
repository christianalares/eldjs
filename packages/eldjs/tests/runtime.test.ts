import { expect, test } from 'vitest'
import {
  createApp,
  createRoute,
  createRootRoute,
  createHandler,
  createMiddleware,
} from '../src/index.js'
import { z } from 'zod'

test('an API route returns JSON through a Hono app', async () => {
  const root = createRootRoute()
  const health = createRoute('/health')({
    handlers: { GET: ({ c }) => c.json({ healthy: true }) },
  }).update({ path: '/health', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ health }) })
  const response = await app.request('/health')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ healthy: true })
})

test('an extracted handler validates async JSON and receives explicit middleware context', async () => {
  const auth = createMiddleware().server(async ({ request, next }) => {
    if (!request.headers.has('authorization'))
      return new Response('Unauthorized', { status: 401 })
    const result = await next({ context: { user: { id: 'ada' } } })
    result.response.headers.set('x-auth', 'passed')
    return result
  })
  const save = createHandler({
    middleware: [auth],
    validate: {
      json: z.object({
        title: z
          .string()
          .min(1)
          .transform(async (s) => s.trim()),
      }),
    },
    handler: ({ input, context, c }) =>
      c.json({ title: input.json.title, owner: context.user.id }, 201),
  })
  const root = createRootRoute()
  const posts = createRoute('/posts')({ handlers: { POST: save } }).update({
    path: '/posts',
    getParentRoute: () => root,
  })
  const app = createApp({ routeTree: root._addFileChildren({ posts }) })
  const response = await app.request('/posts', {
    method: 'POST',
    headers: { authorization: 'test', 'content-type': 'application/json' },
    body: JSON.stringify({ title: ' Hello ' }),
  })
  expect(response.status).toBe(201)
  expect(response.headers.get('x-auth')).toBe('passed')
  expect(await response.json()).toEqual({ title: 'Hello', owner: 'ada' })
  expect((await app.request('/posts', { method: 'POST' })).status).toBe(401)
})
