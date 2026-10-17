import { hc, type InferResponseType } from 'hono/client'
import { expectTypeOf } from 'vitest'
import {
  createApp,
  createMiddleware,
  createRootRoute,
  createRoute,
} from '../src/index.js'

const unavailable = createMiddleware().server(({ c, next }) => {
  if (c.req.header('x-unavailable'))
    return c.json({ error: 'Unavailable' }, 503)
  return next()
})
const auth = createMiddleware().server(({ c, next }) => {
  if (!c.req.header('authorization'))
    return c.json({ error: 'Sign in required' }, 401)
  return next({ context: { userId: 'user-1' } })
})
const permission = createMiddleware()
  .middleware([auth])
  .server(({ c, context, next }) => {
    if (context.userId !== 'admin') return c.json({ error: 'Forbidden' }, 403)
    return next()
  })
const parent = createRoute('/group')({ middleware: [auth] })
const nested = createRoute('/nested')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: { handler: ({ c }) => c.json({ value: 'ok' }, 200) },
      POST: {
        middleware: [permission],
        handler: ({ c }) => c.json({ value: 'created' }, 201),
      },
    }),
})
const root = createRootRoute({ middleware: [unavailable] })
const app = createApp({
  routeTree: root._addFileChildren({
    parent: parent._addFileChildren({ nested }),
  }),
})
const client = hc<typeof app>('http://localhost')
expectTypeOf<
  InferResponseType<typeof client.nested.$get, 200>
>().toEqualTypeOf<{ value: string }>()
expectTypeOf<
  InferResponseType<typeof client.nested.$get, 401>
>().toEqualTypeOf<{ error: string }>()
expectTypeOf<
  InferResponseType<typeof client.nested.$get, 503>
>().toEqualTypeOf<{ error: string }>()
expectTypeOf<InferResponseType<typeof client.nested.$get, 403>>().toBeNever()
expectTypeOf<
  InferResponseType<typeof client.nested.$post, 403>
>().toEqualTypeOf<{ error: string }>()
expectTypeOf<InferResponseType<typeof client.nested.$head, 401>>().toBeNever()
expectTypeOf<
  Awaited<ReturnType<typeof client.nested.$head>>['status']
>().toEqualTypeOf<200 | 401 | 503>()

async function narrowMiddlewareResponses() {
  const response = await client.nested.$get()
  if (!response.ok) {
    expectTypeOf((await response.json()).error).toEqualTypeOf<string>()
  } else {
    expectTypeOf((await response.json()).value).toEqualTypeOf<string>()
  }
}

// Middleware dependencies also contribute responses without a route-level declaration.
const dependencyApp = createApp({
  routeTree: createRootRoute()._addFileChildren({ nested }),
})
const dependencyClient = hc<typeof dependencyApp>('http://localhost')
expectTypeOf<
  InferResponseType<typeof dependencyClient.nested.$post, 401>
>().toEqualTypeOf<{ error: string }>()
expectTypeOf<
  InferResponseType<typeof dependencyClient.nested.$get, 401>
>().toBeNever()

const globalApp = createApp({
  routeTree: createRootRoute()._addFileChildren({ nested }),
  middleware: [unavailable],
})
const globalClient = hc<typeof globalApp>('http://localhost')
expectTypeOf<
  InferResponseType<typeof globalClient.nested.$get, 503>
>().toEqualTypeOf<{ error: string }>()
