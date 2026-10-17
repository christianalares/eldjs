import { expect, test } from 'vitest'
import { Hono } from 'hono'
import { createApp, createRootRoute, createRoute } from '../src/index.js'

function routingApp() {
  const root = createRootRoute()
  const define = <P extends string>(path: P) =>
    createRoute(path)({
      handlers: { GET: ({ c, params }) => c.json({ route: path, params }) },
    }).update({ path, getParentRoute: () => root })
  return createApp({
    routeTree: root._addFileChildren({
      dynamic: define('/users/$id'),
      static: define('/users/new'),
      optional: define('/catalog/{-$category}'),
      splat: define('/files/$'),
      affix: define('/downloads/file-{$id}.json'),
    }),
  })
}

test('default matching preserves native Hono middleware path boundaries', async () => {
  const root = createRootRoute()
  const route = createRoute('/api/private')({
    handlers: { GET: ({ c }) => c.json({ secret: true }, 200) },
  }).update({ path: '/api/private', getParentRoute: () => root })
  const hono = new Hono()
  hono.use('/api/*', async (c) => c.json({ error: 'Unauthorized' }, 401))
  const app = createApp({ hono, routeTree: root._addFileChildren({ route }) })
  expect((await app.request('/api/private')).status).toBe(401)
  expect((await app.request('/API/private')).status).toBe(404)
  expect((await app.request('/%61pi/private')).status).toBe(401)
})

test('case-insensitive matching can be selected explicitly', async () => {
  const root = createRootRoute()
  const route = createRoute('/health')({
    handlers: { GET: ({ c }) => c.json({ ok: true }, 200) },
  }).update({ path: '/health', getParentRoute: () => root })
  const app = createApp({
    routeTree: root._addFileChildren({ route }),
    caseSensitive: false,
  })
  expect((await app.request('/HEALTH')).status).toBe(200)
})

test.each([
  ['/users/new', '/users/new', {}],
  ['/users/a%20b', '/users/$id', { id: 'a b' }],
  ['/catalog', '/catalog/{-$category}', {}],
  ['/catalog/books', '/catalog/{-$category}', { category: 'books' }],
  ['/files/a/b.txt', '/files/$', { _splat: 'a/b.txt' }],
  ['/downloads/file-12.json', '/downloads/file-{$id}.json', { id: '12' }],
])('TanStack matching: %s', async (url, route, params) => {
  const response = await routingApp().request(url)
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ route, params })
})

test('method selection is path-first, supports ANY, and returns Allow for 405', async () => {
  const root = createRootRoute()
  const dynamic = createRoute('/users/$id')({
    handlers: { POST: ({ c }) => c.text('dynamic') },
  }).update({ path: '/users/$id', getParentRoute: () => root })
  const fixed = createRoute('/users/new')({
    handlers: { GET: ({ c }) => c.text('static') },
  }).update({ path: '/users/new', getParentRoute: () => root })
  const any = createRoute('/any')({
    handlers: { ANY: ({ c, request }) => c.text(request.method) },
  }).update({ path: '/any', getParentRoute: () => root })
  const app = createApp({
    routeTree: root._addFileChildren({ dynamic, fixed, any }),
  })
  const response = await app.request('/users/new', { method: 'POST' })
  expect(response.status).toBe(405)
  expect(response.headers.get('allow')).toBe('GET, HEAD')
  expect((await app.request('/missing')).status).toBe(404)
  expect(await (await app.request('/any', { method: 'PATCH' })).text()).toBe(
    'PATCH',
  )
})

test('HEAD uses an explicit handler or falls back to GET and always removes the body', async () => {
  const root = createRootRoute()
  const get = createRoute('/get')({
    handlers: { GET: ({ c }) => c.text('get', 200, { 'x-handler': 'get' }) },
  }).update({ path: '/get', getParentRoute: () => root })
  const head = createRoute('/head')({
    handlers: {
      GET: ({ c }) => c.text('get'),
      HEAD: ({ c }) => c.text('head', 200, { 'x-handler': 'head' }),
    },
  }).update({ path: '/head', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ get, head }) })
  for (const name of ['get', 'head']) {
    const response = await app.request(`/${name}`, { method: 'HEAD' })
    expect(response.headers.get('x-handler')).toBe(name)
    expect(await response.text()).toBe('')
  }
})
