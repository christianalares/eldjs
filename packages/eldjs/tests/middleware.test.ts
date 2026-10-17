import { expect, test } from 'vitest'
import { Hono } from 'hono'
import {
  createApp,
  createHandler,
  createMiddleware,
  createRootRoute,
  createRoute,
} from '../src/index.js'

test('middleware composes dependencies, inherited routes and method hooks once per request', async () => {
  const calls: string[] = []
  const shared = createMiddleware().handler(async ({ next }) => {
    calls.push('shared:before')
    const result = await next({ context: { user: 'ada' } })
    calls.push('shared:after')
    return result
  })
  const auth = createMiddleware()
    .middleware([shared])
    .handler(async ({ next, context }) => {
      calls.push(`auth:${context.user}`)
      return next({ context: { role: 'admin' as const } })
    })
  const method = createMiddleware()
    .middleware([auth])
    .handler(({ next, context }) => {
      calls.push(`method:${context.role}`)
      return next()
    })
  const root = createRootRoute({ middleware: [shared] })
  const parent = createRoute('/teams')({ middleware: [auth] }).update({
    path: '/teams',
    getParentRoute: () => root,
  })
  const child = createRoute('/teams/$id')({
    handlers: {
      GET: createHandler({
        middleware: [method, shared],
        handler: ({ c, context }) => {
          calls.push('handler')
          return c.json(context)
        },
      }),
    },
  }).update({ path: '/$id', getParentRoute: () => parent })
  const native = new Hono()
  native.use('*', async (c, next) => {
    calls.push('hono')
    await next()
    c.header('x-native', 'yes')
  })
  const app = createApp({
    hono: native,
    middleware: [shared],
    routeTree: root._addFileChildren({
      parent: parent._addFileChildren({ child }),
    }),
  })
  const response = await app.request('/teams/1')
  expect(await response.json()).toEqual({ user: 'ada', role: 'admin' })
  expect(response.headers.get('x-native')).toBe('yes')
  expect(calls).toEqual([
    'hono',
    'shared:before',
    'auth:ada',
    'method:admin',
    'handler',
    'shared:after',
  ])
})

test('global middleware wraps not-found responses and can short-circuit', async () => {
  const middleware = createMiddleware().handler(async ({ request, next }) => {
    if (request.headers.has('x-stop'))
      return new Response('stopped', { status: 403 })
    const result = await next()
    result.response.headers.set('x-wrapped', 'yes')
    return result
  })
  const app = createApp({
    routeTree: createRootRoute(),
    middleware: [middleware],
  })
  const response = await app.request('/missing')
  expect(response.status).toBe(404)
  expect(response.headers.get('x-wrapped')).toBe('yes')
  expect(
    (await app.request('/missing', { headers: { 'x-stop': 'yes' } })).status,
  ).toBe(403)
})
